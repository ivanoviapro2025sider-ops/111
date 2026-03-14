import type { Agent, AgentFunction, ChatMessage as PrismaMessage, ChatSession, GlobalSettings, UploadedFile } from '@prisma/client';
import type { AgentConfig } from '@/types/agent';
import type { ChatMessage, ChatSession as ChatSessionDto } from '@/types/chat';
import type { UploadedFileRecord } from '@/types/file';
import { tryParseJson } from '@/lib/utils';

export function serializeAgent(agent: Agent & { functions?: AgentFunction[] }): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    instructions: agent.instructions,
    isActive: agent.isActive,
    avatar: agent.avatar,
    color: agent.color,
    temperature: agent.temperature,
    topP: agent.topP,
    topK: agent.topK,
    frequencyPenalty: agent.frequencyPenalty,
    presencePenalty: agent.presencePenalty,
    repetitionPenalty: agent.repetitionPenalty,
    minP: agent.minP,
    topA: agent.topA,
    maxTokens: agent.maxTokens,
    seed: agent.seed,
    stop: tryParseJson<string[]>(agent.stop, []),
    responseFormat: agent.responseFormat as AgentConfig['responseFormat'],
    verbosity: agent.verbosity as AgentConfig['verbosity'],
    maxTurns: agent.maxTurns,
    executeTools: agent.executeTools,
    stream: agent.stream,
    debug: agent.debug,
    contextVariables: tryParseJson<Record<string, unknown>>(agent.contextVariables, {}),
    handoffTargetIds: tryParseJson<string[]>(agent.handoffTargetIds, []),
    handoffConditions: agent.handoffConditions,
    toolChoice: agent.toolChoice as AgentConfig['toolChoice'],
    parallelToolCalls: agent.parallelToolCalls,
    functions: (agent.functions ?? []).map((fn) => ({ id: fn.id, name: fn.name, description: fn.description, parameters: tryParseJson<Record<string, unknown>>(fn.parameters, {}), implementation: fn.implementation, isHandoff: fn.isHandoff, handoffTarget: fn.handoffTarget })),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function serializeSettings(settings: GlobalSettings) {
  return { ...settings, createdAt: settings.createdAt.toISOString(), updatedAt: settings.updatedAt.toISOString(), globalContextVariables: tryParseJson<Record<string, unknown>>(settings.globalContextVariables, {}) };
}

export function serializeChatMessage(message: PrismaMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role as ChatMessage['role'],
    content: message.content,
    agent: message.agent ?? undefined,
    agentColor: message.agentColor ?? undefined,
    timestamp: message.createdAt.toISOString(),
    attachments: tryParseJson(message.attachments, []),
    toolCalls: tryParseJson(message.toolCalls, []),
    isStreaming: message.isStreaming,
    metadata: tryParseJson(message.metadata, {}),
  };
}

export function serializeSession(session: ChatSession & { messages?: PrismaMessage[] }): ChatSessionDto {
  return { id: session.id, title: session.title, agentId: session.agentId, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(), messages: session.messages?.map(serializeChatMessage) };
}

export function serializeFile(file: UploadedFile): UploadedFileRecord {
  return { id: file.id, fileName: file.fileName, storedName: file.storedName, path: file.path, mimeType: file.mimeType, size: file.size, status: file.status as UploadedFileRecord['status'], extractedText: file.extractedText, summary: file.summary, metadata: tryParseJson(file.metadata, {}), createdAt: file.createdAt.toISOString(), updatedAt: file.updatedAt.toISOString() };
}
