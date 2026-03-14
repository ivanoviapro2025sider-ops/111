import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get('chatId');
  const format = request.nextUrl.searchParams.get('format') || 'json';

  if (!chatId) {
    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  }

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    if (format === 'json') {
      return NextResponse.json({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        messages: chat.messages.map((m) => ({
          role: m.role,
          content: m.content,
          agent: m.agentName,
          timestamp: m.createdAt,
        })),
      });
    }

    if (format === 'markdown') {
      let md = `# ${chat.title}\n\n`;
      md += `*Created: ${chat.createdAt.toISOString()}*\n\n---\n\n`;
      for (const msg of chat.messages) {
        const label = msg.role === 'user' ? 'User' : msg.agentName || 'Assistant';
        md += `**${label}:**\n\n${msg.content}\n\n---\n\n`;
      }
      return new Response(md, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${chat.title}.md"`,
        },
      });
    }

    if (format === 'txt') {
      let txt = `${chat.title}\n${'='.repeat(chat.title.length)}\n\n`;
      for (const msg of chat.messages) {
        const label = msg.role === 'user' ? 'User' : msg.agentName || 'Assistant';
        txt += `[${label}]\n${msg.content}\n\n`;
      }
      return new Response(txt, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${chat.title}.txt"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
