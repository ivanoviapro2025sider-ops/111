import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOpenRouterClient } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message, apiKey } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'projectId and message are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const instruction = project.instruction
      ? JSON.parse(project.instruction)
      : null;

    const client = createOpenRouterClient(apiKey || undefined);

    const existingMessages = await prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    const systemContent = instruction
      ? `You are KIMI, a helpful assistant. Use the following instruction as context to answer questions:\n\n${JSON.stringify(instruction, null, 2)}`
      : 'You are KIMI, a helpful assistant.';

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemContent },
      ...existingMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    await prisma.chatMessage.create({
      data: {
        projectId,
        role: 'user',
        content: message,
      },
    });

    const stream = await client.chat.completions.create({
      model: process.env.OPENROUTER_CHAT_MODEL || 'moonshotai/kimi-k2',
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
              );
            }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );

          await prisma.chatMessage.create({
            data: {
              projectId,
              role: 'assistant',
              content: fullContent,
            },
          });
        } catch (err) {
          console.error('Chat stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('POST /api/chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
}
