import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    const where = chatId ? { chatId } : {};
    const files = await prisma.fileRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(files.map(f => ({
      ...f,
      metadata: JSON.parse(f.metadata),
    })));
  } catch (error) {
    console.error('GET /api/files error:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
