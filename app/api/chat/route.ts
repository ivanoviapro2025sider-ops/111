import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOpenRouterClient } from '@/lib/openrouter';

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedChats = chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      messages: chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agent: m.agentName,
        agentColor: m.agentColor,
        timestamp: m.createdAt.toISOString(),
        metadata: JSON.parse(m.metadata),
      })),
    }));

    return NextResponse.json({ chats: formattedChats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.title !== undefined && !body.messages) {
      const chat = await prisma.chat.create({
        data: { title: body.title || 'New Chat' },
      });
      return NextResponse.json({
        chat: {
          id: chat.id,
          title: chat.title,
          messages: [],
          createdAt: chat.createdAt.toISOString(),
          updatedAt: chat.updatedAt.toISOString(),
        },
      });
    }

    const { messages, agentId, chatId, contextVariables } = body;

    let agent = null;
    if (agentId) {
      agent = await prisma.agent.findUnique({ where: { id: agentId } });
    }
    if (!agent) {
      const agents = await prisma.agent.findMany({ where: { isActive: true }, take: 1 });
      agent = agents[0] || null;
    }

    let chat;
    if (chatId) {
      chat = await prisma.chat.findUnique({ where: { id: chatId } });
    }
    if (!chat) {
      chat = await prisma.chat.create({ data: { title: 'New Chat' } });
    }

    const lastUserMsg = messages?.[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      await prisma.message.create({
        data: {
          role: 'user',
          content: lastUserMsg.content,
          chatId: chat.id,
        },
      });
    }

    const model = agent?.model || process.env.OPENROUTER_DEFAULT_MODEL || 'moonshotai/kimi-k2';
    const client = createOpenRouterClient();

    const systemMessage = agent?.instructions
      ? {
          role: 'system' as const,
          content: replaceVariables(agent.instructions, contextVariables || {}),
        }
      : null;

    const apiMessages = [
      ...(systemMessage ? [systemMessage] : []),
      ...(messages || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const tools = agent ? buildToolsForAgent(agent) : [];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const params: Record<string, unknown> = {
            model,
            messages: apiMessages,
            stream: true,
            temperature: agent?.temperature ?? 1.0,
            max_tokens: agent?.maxTokens ?? 4096,
          };
          if (agent?.topP !== undefined && agent.topP !== 1.0) params.top_p = agent.topP;
          if (agent?.frequencyPenalty) params.frequency_penalty = agent.frequencyPenalty;
          if (agent?.presencePenalty) params.presence_penalty = agent.presencePenalty;
          if (tools.length > 0) {
            params.tools = tools;
            params.tool_choice = agent?.toolChoice || 'auto';
          }

          const response = await client.chat.completions.create(
            params as unknown as Parameters<typeof client.chat.completions.create>[0]
          );

          let fullContent = '';

          for await (const chunk of response as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              const event = `data: ${JSON.stringify({
                type: 'content',
                data: content,
                agent: agent?.name,
                agentColor: agent?.color,
              })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }
          }

          await prisma.message.create({
            data: {
              role: 'assistant',
              content: fullContent,
              chatId: chat!.id,
              agentId: agent?.id,
              agentName: agent?.name,
              agentColor: agent?.color,
              metadata: JSON.stringify({ model }),
            },
          });

          if (messages?.length === 1) {
            const title = fullContent.slice(0, 50) + (fullContent.length > 50 ? '...' : '');
            await prisma.chat.update({ where: { id: chat!.id }, data: { title } });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', chatId: chat!.id })}\n\n`));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', data: errMsg })}\n\n`)
          );
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
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    await prisma.chat.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}

function replaceVariables(template: string, variables: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function buildToolsForAgent(agent: { functions?: string; handoffTargets?: string }) {
  const tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> = [];

  try {
    const fns = typeof agent.functions === 'string' ? JSON.parse(agent.functions) : agent.functions;
    for (const fn of fns || []) {
      tools.push({
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description || '',
          parameters: fn.parameters || { type: 'object', properties: {} },
        },
      });
    }
  } catch {
    // ignore parse errors
  }

  return tools;
}
