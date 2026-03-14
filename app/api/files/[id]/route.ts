import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { unlink } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: params.id },
    });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: params.id },
    });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    try {
      await unlink(file.path);
    } catch {
      // File may already be deleted
    }

    await prisma.uploadedFile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
