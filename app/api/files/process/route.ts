import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { extractTextFromFile } from '@/lib/file-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }

    const file = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await prisma.fileRecord.update({
      where: { id: fileId },
      data: { status: 'processing' },
    });

    try {
      const text = await extractTextFromFile(file.path, file.originalName);

      await prisma.fileRecord.update({
        where: { id: fileId },
        data: {
          status: 'processed',
          processedText: text,
        },
      });

      return NextResponse.json({
        success: true,
        fileId,
        textLength: text.length,
        preview: text.slice(0, 500),
      });
    } catch (error) {
      await prisma.fileRecord.update({
        where: { id: fileId },
        data: { status: 'error' },
      });

      return NextResponse.json({
        error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/files/process error:', error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
