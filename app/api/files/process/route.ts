import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processFile } from '@/lib/file-processor';
import { serializeFile } from '@/lib/server-data';

export const runtime = 'nodejs';

export async function GET() {
  const files = await prisma.uploadedFile.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ files: files.map(serializeFile) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const file = await prisma.uploadedFile.findUnique({ where: { id: body.fileId } });
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  await prisma.uploadedFile.update({ where: { id: file.id }, data: { status: 'processing' } });
  const result = await processFile(file.path, file.mimeType, { strategy: body.strategy ?? 'chunked', chunkSize: body.chunkSize ?? 6000, chunkOverlap: body.chunkOverlap ?? 600, maxContextTokens: body.maxContextTokens ?? 12000, preprocessor: body.preprocessor });
  const updated = await prisma.uploadedFile.update({ where: { id: file.id }, data: { status: 'processed', extractedText: result.text, summary: result.summary, metadata: JSON.stringify({ ...(typeof result.metadata === 'object' ? result.metadata : {}), chunks: result.chunks.length }) } });
  return NextResponse.json({ file: serializeFile(updated), chunks: result.chunks.length });
}
