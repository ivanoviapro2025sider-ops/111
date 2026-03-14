import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processFile, chunkText } from '@/lib/file-processor';

export async function POST(request: NextRequest) {
  try {
    const { fileId, strategy = 'full', chunkSize = 4000, chunkOverlap = 200 } = await request.json();

    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'processing' },
    });

    try {
      const content = await processFile(file.path, file.originalName);

      let processedContent = content;
      if (strategy === 'chunked') {
        const chunks = chunkText(content, chunkSize, chunkOverlap);
        processedContent = chunks.map((c, i) => `[Chunk ${i + 1}/${chunks.length}]\n${c}`).join('\n\n---\n\n');
      }

      const updatedFile = await prisma.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'processed',
          processedContent,
          metadata: JSON.stringify({
            originalLength: content.length,
            processedLength: processedContent.length,
            strategy,
            processedAt: new Date().toISOString(),
          }),
        },
      });

      return NextResponse.json({ file: updatedFile });
    } catch (error) {
      await prisma.uploadedFile.update({
        where: { id: fileId },
        data: { status: 'error', metadata: JSON.stringify({ error: String(error) }) },
      });
      throw error;
    }
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
