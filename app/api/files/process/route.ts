import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processFile } from '@/lib/file-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'processing' },
    });

    try {
      const content = await processFile(file.path, file.originalName);
      const updated = await prisma.uploadedFile.update({
        where: { id: fileId },
        data: { status: 'processed', processedContent: content },
      });
      return NextResponse.json(updated);
    } catch (error) {
      await prisma.uploadedFile.update({
        where: { id: fileId },
        data: { status: 'error' },
      });
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Processing failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
