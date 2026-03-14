import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runSwarm } from '@/lib/swarm';
import type { Agent } from '@/types/agent';

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: { include: { file: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chat = await prisma.chat.create({
      data: {
        title: body.title || 'New Chat',
        agentId: body.agentName,
      },
      include: { messages: true },
    });
    return NextResponse.json(chat);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, message, agentName, fileIds } = body;

    if (!chatId || !message) {
      return NextResponse.json({ error: 'chatId and message are required' }, { status: 400 });
    }

    await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
      },
    });

    let titleUpdated = false;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: true },
    });

    if (chat && chat.title === 'New Chat') {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await prisma.chat.update({ where: { id: chatId }, data: { title } });
      titleUpdated = true;
    }

    let agent: Agent | null = null;
    if (agentName) {
      const dbAgent = await prisma.agent.findUnique({ where: { name: agentName } });
      if (dbAgent) {
        agent = {
          ...dbAgent,
          stop: JSON.parse(dbAgent.stop),
          contextVariables: JSON.parse(dbAgent.contextVariables),
          handoffTargets: JSON.parse(dbAgent.handoffTargets),
          functions: JSON.parse(dbAgent.functions),
          responseFormat: dbAgent.responseFormat as 'text' | 'json_object',
          toolChoice: dbAgent.toolChoice as 'none' | 'auto' | 'required',
          createdAt: dbAgent.createdAt.toISOString(),
          updatedAt: dbAgent.updatedAt.toISOString(),
        };
      }
    }

    if (!agent) {
      const firstAgent = await prisma.agent.findFirst({ where: { isActive: true } });
      if (firstAgent) {
        agent = {
          ...firstAgent,
          stop: JSON.parse(firstAgent.stop),
          contextVariables: JSON.parse(firstAgent.contextVariables),
          handoffTargets: JSON.parse(firstAgent.handoffTargets),
          functions: JSON.parse(firstAgent.functions),
          responseFormat: firstAgent.responseFormat as 'text' | 'json_object',
          toolChoice: firstAgent.toolChoice as 'none' | 'auto' | 'required',
          createdAt: firstAgent.createdAt.toISOString(),
          updatedAt: firstAgent.updatedAt.toISOString(),
        };
      }
    }

    if (!agent) {
      agent = {
        id: 'default',
        name: 'KIMI Assistant',
        description: 'Default assistant',
        model: process.env.OPENROUTER_DEFAULT_MODEL || 'moonshotai/kimi-k2',
        instructions: 'You are a helpful assistant powered by KIMI K2.',
        isActive: true,
        avatar: 'bot',
        color: '#6366f1',
        temperature: 1.0,
        topP: 1.0,
        topK: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        repetitionPenalty: 1.0,
        minP: 0,
        topA: 0,
        maxTokens: 4096,
        seed: null,
        stop: [],
        responseFormat: 'text',
        maxTurns: 0,
        executeTools: true,
        stream: true,
        debug: false,
        contextVariables: {},
        handoffTargets: [],
        handoffConditions: '',
        toolChoice: 'auto',
        parallelToolCalls: true,
        functions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const allAgentsDb = await prisma.agent.findMany({ where: { isActive: true } });
    const allAgents: Agent[] = allAgentsDb.map((a) => ({
      ...a,
      stop: JSON.parse(a.stop),
      contextVariables: JSON.parse(a.contextVariables),
      handoffTargets: JSON.parse(a.handoffTargets),
      functions: JSON.parse(a.functions),
      responseFormat: a.responseFormat as 'text' | 'json_object',
      toolChoice: a.toolChoice as 'none' | 'auto' | 'required',
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    let fileContents: string | undefined;
    if (fileIds && fileIds.length > 0) {
      const files = await prisma.uploadedFile.findMany({
        where: { id: { in: fileIds } },
      });
      const contents = files
        .filter((f) => f.processedContent)
        .map((f) => `--- ${f.originalName} ---\n${f.processedContent}`)
        .join('\n\n');
      if (contents) fileContents = contents;
    }

    const history = (chat?.messages || []).map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      agentName: m.agentName || undefined,
      agentColor: m.agentColor || undefined,
      timestamp: m.createdAt.toISOString(),
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        let lastAgentName = agent!.name;
        let lastAgentColor = agent!.color;

        try {
          for await (const chunk of runSwarm(
            message,
            agent!,
            allAgents,
            history,
            {},
            fileContents
          )) {
            const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(sseData));

            if (chunk.type === 'content' && chunk.content) {
              fullContent += chunk.content;
            }
            if (chunk.agentName) lastAgentName = chunk.agentName;
            if (chunk.agentColor) lastAgentColor = chunk.agentColor;

            if (chunk.type === 'done') {
              await prisma.message.create({
                data: {
                  chatId,
                  role: 'assistant',
                  content: fullContent,
                  agentName: lastAgentName,
                  agentColor: lastAgentColor,
                  metadata: JSON.stringify(chunk.metadata || {}),
                },
              });
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const errorChunk = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process message' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('id');
    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }
    await prisma.chat.delete({ where: { id: chatId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
