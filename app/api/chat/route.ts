import { performance } from 'node:perf_hooks';
import { prisma } from '@/lib/db';
import { processFile } from '@/lib/file-processor';
import { getOpenRouterClient } from '@/lib/openrouter';
import { serializeSession } from '@/lib/server-data';
import { buildFileContext, buildSystemInstruction, chooseAgents } from '@/lib/swarm';
import { tryParseJson } from '@/lib/utils';

export const runtime = 'nodejs';

type AttachmentRef = { id: string; name: string; size: number; type: string };

function sse(event: string, payload: unknown) {
  return `event: ${event}
data: ${JSON.stringify(payload)}

`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (sessionId) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return Response.json({ messages: session?.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, agent: message.agent, agentColor: message.agentColor, timestamp: message.createdAt.toISOString(), attachments: tryParseJson(message.attachments, []), toolCalls: tryParseJson(message.toolCalls, []), isStreaming: message.isStreaming, metadata: tryParseJson(message.metadata, {}) })) ?? [] });
  }
  const sessions = await prisma.chatSession.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
  return Response.json({ sessions: sessions.map(serializeSession) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const start = performance.now();
  const attachments = (body.attachments ?? []) as AttachmentRef[];
  const session = body.sessionId ? await prisma.chatSession.update({ where: { id: body.sessionId }, data: { updatedAt: new Date() } }) : await prisma.chatSession.create({ data: { title: body.content.slice(0, 80) || 'New chat', agentId: body.agentId ?? null } });
  await prisma.chatMessage.create({ data: { sessionId: session.id, role: 'user', content: body.content, attachments: JSON.stringify(attachments), metadata: JSON.stringify({ debug: body.debug ?? false }) } });

  const stream = new ReadableStream({
    start: async (controller) => {
      const encoder = new TextEncoder();
      const push = (event: string, payload: unknown) => controller.enqueue(encoder.encode(sse(event, payload)));
      push('session', { sessionId: session.id });
      try {
        const decision = await chooseAgents(body.content, body.agentId);
        push('handoff', { from: decision.primary.name, to: decision.handoffTo?.name ?? null, reason: decision.handoffReason ?? null });
        const actingAgent = decision.handoffTo ?? decision.primary;
        const attachedFiles = attachments.length ? await prisma.uploadedFile.findMany({ where: { id: { in: attachments.map((item) => item.id) } } }) : [];
        const filePayloads = await Promise.all(attachedFiles.map(async (file) => {
          const processed = file.extractedText ? { text: file.extractedText, summary: file.summary ?? '', chunks: [] } : await processFile(file.path, file.mimeType, { strategy: 'chunked', chunkSize: 6000, chunkOverlap: 600, maxContextTokens: 12000 });
          if (!file.extractedText) {
            await prisma.uploadedFile.update({ where: { id: file.id }, data: { status: 'processed', extractedText: processed.text, summary: processed.summary, metadata: JSON.stringify({ autoProcessedByChat: true, chunks: processed.chunks.length }) } });
          }
          return processed;
        }));
        const fileContext = buildFileContext(filePayloads.map((payload) => payload.text), body.content, { strategy: 'chunked', chunkSize: 6000, chunkOverlap: 600, maxContextTokens: 12000 });
        const summaryContext = filePayloads.map((payload) => payload.summary).filter(Boolean).join('\n\n');
        const systemPrompt = buildSystemInstruction(actingAgent, decision.contextVariables, fileContext, summaryContext);
        const assistantMessage = await prisma.chatMessage.create({ data: { sessionId: session.id, role: 'assistant', content: '', agent: actingAgent.name, agentColor: actingAgent.color, isStreaming: true, metadata: JSON.stringify({ model: actingAgent.model, handoffFrom: decision.primary.name, handoffTo: decision.handoffTo?.name }) } });
        let accumulated = '';
        const baseMessage = { id: assistantMessage.id, role: 'assistant', agent: actingAgent.name, agentColor: actingAgent.color, timestamp: new Date().toISOString(), metadata: { model: actingAgent.model, handoffFrom: decision.primary.name, handoffTo: decision.handoffTo?.name } };
        push('message', { message: { ...baseMessage, content: accumulated, isStreaming: true } });
        const client = await getOpenRouterClient();
        if (!client) {
          const fallback = [
            `Активный агент: ${actingAgent.name}`,
            decision.handoffTo ? `Handoff: ${decision.primary.name} -> ${decision.handoffTo.name}` : 'Handoff не потребовался.',
            fileContext ? `Извлечён контекст из файлов:\n${summaryContext || fileContext.slice(0, 1200)}` : 'Файлы не прикреплены.',
            `\nПользовательский запрос:\n${body.content}`,
            '\nOpenRouter API key не настроен, поэтому сервис отдал локальный демонстрационный ответ. После добавления ключа поток будет идти из Kimi K2 через OpenRouter.',
          ].join('\n\n');
          for (const token of fallback.split(/(\s+)/)) {
            accumulated += token;
            push('message', { message: { ...baseMessage, content: accumulated, isStreaming: true } });
            await new Promise((resolve) => setTimeout(resolve, 12));
          }
        } else {
          const completion = await client.chat.completions.create({ model: actingAgent.model, stream: true, temperature: actingAgent.temperature, top_p: actingAgent.topP, max_tokens: actingAgent.maxTokens, frequency_penalty: actingAgent.frequencyPenalty, presence_penalty: actingAgent.presencePenalty, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: body.content }], stop: tryParseJson(actingAgent.stop, []), seed: actingAgent.seed ?? undefined });
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (!delta) continue;
            accumulated += delta;
            push('message', { message: { ...baseMessage, content: accumulated, isStreaming: true } });
          }
        }
        const processingTime = performance.now() - start;
        await prisma.chatMessage.update({ where: { id: assistantMessage.id }, data: { content: accumulated, isStreaming: false, metadata: JSON.stringify({ model: actingAgent.model, processingTime, handoffFrom: decision.primary.name, handoffTo: decision.handoffTo?.name, attachedFileIds: attachments.map((item) => item.id) }) } });
        push('message', { message: { ...baseMessage, content: accumulated, isStreaming: false, metadata: { ...baseMessage.metadata, processingTime } } });
        push('done', { sessionId: session.id });
      } catch (error) {
        push('error', { message: error instanceof Error ? error.message : 'Unknown chat error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
