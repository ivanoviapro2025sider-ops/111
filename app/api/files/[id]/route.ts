import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { unlink } from 'fs/promises';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.fileRecord.findUnique({
      where: { id: params.id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...file,
      metadata: JSON.parse(file.metadata),
    });
  } catch (error) {
    console.error('GET /api/files/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.fileRecord.findUnique({
      where: { id: params.id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    try {
      await unlink(file.path);
    } catch {
      // File might already be deleted
    }

    await prisma.fileRecord.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/files/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
