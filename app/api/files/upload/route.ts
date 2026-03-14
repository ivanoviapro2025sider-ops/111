import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assembleUpload, listExistingChunks, writeChunk } from '@/lib/chunked-upload';
import { serializeFile } from '@/lib/server-data';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploadId = String(formData.get('uploadId') ?? '');
  const chunkIndex = Number(formData.get('chunkIndex') ?? 0);
  const totalChunks = Number(formData.get('totalChunks') ?? 1);
  const fileName = String(formData.get('fileName') ?? 'upload.bin');
  const mimeType = String(formData.get('mimeType') ?? 'application/octet-stream');
  const chunk = formData.get('chunk');
  if (!(chunk instanceof File)) return NextResponse.json({ error: 'Chunk is required' }, { status: 400 });
  const buffer = Buffer.from(await chunk.arrayBuffer());
  await writeChunk({ uploadId, chunkIndex, totalChunks, fileName, mimeType, chunk: buffer });
  const existing = await listExistingChunks(uploadId);
  if (existing.length < totalChunks) {
    return NextResponse.json({ ok: true, uploadId, chunkIndex, received: existing.length, totalChunks });
  }
  const assembled = await assembleUpload(uploadId, fileName, totalChunks);
  const record = await prisma.uploadedFile.create({ data: { fileName, storedName: assembled.storedName, path: assembled.targetPath, mimeType, size: String(assembled.size), metadata: JSON.stringify({ uploadId, totalChunks }) } });
  return NextResponse.json({ ok: true, file: serializeFile(record) });
}
