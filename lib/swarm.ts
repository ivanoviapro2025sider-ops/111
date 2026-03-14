import type { Agent, AgentFunction } from '@prisma/client';
import { prisma } from '@/lib/db';
import { interpolateTemplate, tryParseJson } from '@/lib/utils';
import type { FileProcessingOptions } from '@/types/file';
import { selectRelevantChunks } from '@/lib/file-processor';

export interface RuntimeAgent extends Agent {
  functions: AgentFunction[];
}

export interface SwarmDecision {
  primary: RuntimeAgent;
  handoffTo?: RuntimeAgent;
  handoffReason?: string;
  contextVariables: Record<string, unknown>;
}

export async function ensureSeedData() {
  const settings = await prisma.globalSettings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } });
  const existing = await prisma.agent.count();
  if (existing > 0) return settings;

  const triage = await prisma.agent.create({ data: { name: 'Agent A', description: 'Главный triage-агент для маршрутизации запросов.', instructions: 'You are the main KIMI triage agent. Analyze the request, decide whether to answer directly or hand off to a specialist. Context: {context_variables}', model: settings.defaultModel, color: '#6366f1', avatar: 'Bot', handoffConditions: 'Передавай аналитические задачи Analyst, задачи генерации текста Writer.' } });
  const analyst = await prisma.agent.create({ data: { name: 'Analyst', description: 'Агент для анализа документов, данных и файлов.', instructions: 'You are Analyst. Focus on extracting facts, summarizing large documents, and providing structured findings. File context: {file_context}', model: 'moonshotai/kimi-k2-thinking', color: '#10b981', avatar: 'FlaskConical' } });
  const writer = await prisma.agent.create({ data: { name: 'Writer', description: 'Агент для подготовки итоговых текстов, ответов и инструкций.', instructions: 'You are Writer. Produce polished, concise answers in the requested language. Summary context: {summary_context}', model: settings.defaultModel, color: '#f59e0b', avatar: 'PenTool' } });
  await prisma.agent.update({ where: { id: triage.id }, data: { handoffTargetIds: JSON.stringify([analyst.id, writer.id]) } });
  return settings;
}

export async function getRuntimeAgents() {
  await ensureSeedData();
  return prisma.agent.findMany({ include: { functions: true }, orderBy: { createdAt: 'asc' } });
}

export async function chooseAgents(message: string, requestedAgentId?: string | null) {
  const agents = await getRuntimeAgents();
  const active = agents.filter((agent) => agent.isActive);
  const primary = active.find((agent) => agent.id === requestedAgentId) ?? active[0];
  if (!primary) throw new Error('No active agents configured.');
  const normalized = message.toLowerCase();
  const handoffIds = tryParseJson<string[]>(primary.handoffTargetIds, []);
  const handoffCandidates = active.filter((agent) => handoffIds.includes(agent.id));
  const analyst = handoffCandidates.find((agent) => agent.name.toLowerCase().includes('analyst'));
  const writer = handoffCandidates.find((agent) => agent.name.toLowerCase().includes('writer'));
  let handoffTo: RuntimeAgent | undefined;
  let handoffReason: string | undefined;
  if (analyst && /(анализ|analyse|analyz|summary|file|pdf|csv|таблиц|документ)/i.test(normalized)) {
    handoffTo = analyst;
    handoffReason = 'Запрос содержит признаки анализа файла или данных.';
  } else if (writer && /(write|draft|rewrite|email|стать|текст|письм|пост)/i.test(normalized)) {
    handoffTo = writer;
    handoffReason = 'Запрос похож на генерацию или переработку текста.';
  }
  return { primary, handoffTo, handoffReason, contextVariables: tryParseJson<Record<string, unknown>>(primary.contextVariables, {}) } satisfies SwarmDecision;
}

export function buildSystemInstruction(agent: RuntimeAgent, context: Record<string, unknown>, fileContext?: string, summaryContext?: string) {
  return interpolateTemplate(agent.instructions, { ...context, context_variables: JSON.stringify(context, null, 2), file_context: fileContext ?? 'No files attached.', summary_context: summaryContext ?? 'No summary available.' });
}

export function buildFileContext(fileTexts: string[], userMessage: string, options: FileProcessingOptions) {
  return fileTexts
    .flatMap((text) => selectRelevantChunks(text, userMessage, options))
    .slice(0, 6)
    .join('\n\n---\n\n');
}
