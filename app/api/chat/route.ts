import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOpenRouterClient } from '@/lib/openrouter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (chatId) {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

      return NextResponse.json({
        ...chat,
        messages: chat.messages.map(m => ({
          ...m,
          attachments: JSON.parse(m.attachments),
          toolCalls: JSON.parse(m.toolCalls),
          metadata: JSON.parse(m.metadata),
          timestamp: m.createdAt.toISOString(),
        })),
      });
    }

    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('GET /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chat = await prisma.chat.create({
      data: { title: body.title || 'New Chat' },
    });
    return NextResponse.json(chat);
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, message, agentId, attachments } = body;

    if (!chatId || !message) {
      return NextResponse.json({ error: 'chatId and message required' }, { status: 400 });
    }

    await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
        attachments: JSON.stringify(attachments || []),
      },
    });

    const allMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    let activeAgent = null;
    if (agentId) {
      activeAgent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { functions: true },
      });
    }

    if (!activeAgent) {
      activeAgent = await prisma.agent.findFirst({
        where: { isActive: true },
        include: { functions: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    let fileContext = '';
    if (attachments?.length) {
      const files = await prisma.fileRecord.findMany({
        where: { id: { in: attachments } },
      });
      for (const file of files) {
        if (file.processedText) {
          fileContext += `\n\n[File: ${file.originalName}]\n${file.processedText}`;
        }
      }
    }

    const model = activeAgent?.model || process.env.OPENROUTER_DEFAULT_MODEL || 'moonshotai/kimi-k2';
    const client = createOpenRouterClient();

    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (activeAgent?.instructions) {
      let sysPrompt = activeAgent.instructions;
      if (fileContext) {
        sysPrompt += `\n\nRelevant file contents:${fileContext}`;
      }
      apiMessages.push({ role: 'system', content: sysPrompt });
    } else if (fileContext) {
      apiMessages.push({ role: 'system', content: `File contents for reference:${fileContext}` });
    }

    for (const m of allMessages) {
      if (m.role === 'user' || m.role === 'assistant') {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'agent',
            name: activeAgent?.name || 'Assistant',
            color: activeAgent?.color || '#6366f1',
            id: activeAgent?.id || '',
          })}\n\n`));

          const params: Record<string, unknown> = {
            model,
            messages: apiMessages,
            stream: true,
            temperature: activeAgent?.temperature ?? 1.0,
            top_p: activeAgent?.topP ?? 1.0,
            max_tokens: activeAgent?.maxTokens ?? 4096,
          };

          if (activeAgent?.frequencyPenalty) params.frequency_penalty = activeAgent.frequencyPenalty;
          if (activeAgent?.presencePenalty) params.presence_penalty = activeAgent.presencePenalty;
          if (activeAgent?.seed != null) params.seed = activeAgent.seed;

          const completion = await client.chat.completions.create(
            params as Parameters<typeof client.chat.completions.create>[0]
          );

          let fullContent = '';

          for await (const chunk of completion as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                content,
              })}\n\n`));
            }
          }

          await prisma.message.create({
            data: {
              chatId,
              role: 'assistant',
              content: fullContent,
              agentName: activeAgent?.name || 'Assistant',
              agentColor: activeAgent?.color || '#6366f1',
              agentId: activeAgent?.id || null,
              metadata: JSON.stringify({
                model,
              }),
            },
          });

          const msgCount = allMessages.length;
          if (msgCount <= 2) {
            const titleContent = fullContent.slice(0, 50).replace(/\n/g, ' ');
            await prisma.chat.update({
              where: { id: chatId },
              data: { title: titleContent || 'Chat' },
            });
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('PUT /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId required' }, { status: 400 });
    }

    await prisma.chat.delete({ where: { id: chatId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/chat error:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
