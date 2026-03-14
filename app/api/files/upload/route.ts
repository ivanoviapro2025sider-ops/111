import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import prisma from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const CHUNKS_DIR = join(UPLOAD_DIR, '.chunks');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileSize, mimeType, totalChunks, chatId } = body;

    const uploadId = uuidv4();
    const chunkDir = join(CHUNKS_DIR, uploadId);

    await mkdir(chunkDir, { recursive: true });

    const fileRecord = await prisma.fileRecord.create({
      data: {
        id: uploadId,
        name: `${uploadId}_${fileName}`,
        originalName: fileName,
        mimeType: mimeType || 'application/octet-stream',
        size: fileSize,
        path: join(UPLOAD_DIR, `${uploadId}_${fileName}`),
        status: 'uploading',
        chatId: chatId || null,
        metadata: JSON.stringify({ totalChunks, uploadedChunks: 0 }),
      },
    });

    return NextResponse.json({ uploadId: fileRecord.id });
  } catch (error) {
    console.error('POST /api/files/upload error:', error);
    return NextResponse.json({ error: 'Failed to initialize upload' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);

    if (!chunk || !uploadId) {
      return NextResponse.json({ error: 'Missing chunk or uploadId' }, { status: 400 });
    }

    const chunkDir = join(CHUNKS_DIR, uploadId);
    if (!existsSync(chunkDir)) {
      await mkdir(chunkDir, { recursive: true });
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(join(chunkDir, `chunk_${chunkIndex}`), buffer);

    if (chunkIndex === totalChunks - 1) {
      const file = await prisma.fileRecord.findUnique({ where: { id: uploadId } });
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

      await mkdir(UPLOAD_DIR, { recursive: true });

      const { createWriteStream } = await import('fs');
      const { readFile, rm } = await import('fs/promises');
      const outputPath = file.path;
      const output = createWriteStream(outputPath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = join(chunkDir, `chunk_${i}`);
        const chunkData = await readFile(chunkPath);
        output.write(chunkData);
      }

      await new Promise<void>((resolve, reject) => {
        output.on('finish', resolve);
        output.on('error', reject);
        output.end();
      });

      await rm(chunkDir, { recursive: true, force: true });

      await prisma.fileRecord.update({
        where: { id: uploadId },
        data: { status: 'uploaded' },
      });

      return NextResponse.json({ status: 'completed', fileId: uploadId });
    }

    return NextResponse.json({ status: 'chunk_received', chunkIndex });
  } catch (error) {
    console.error('PUT /api/files/upload error:', error);
    return NextResponse.json({ error: 'Failed to upload chunk' }, { status: 500 });
  }
}
