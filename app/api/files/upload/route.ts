import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, appendFile, rename, stat } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { processFile } from '@/lib/file-processor';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await mkdir(path.join(UPLOAD_DIR, 'chunks'), { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir();

    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob | null;
    const file = formData.get('file') as File | null;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = formData.get('chunkIndex') as string;
    const totalChunks = formData.get('totalChunks') as string;
    const filename = formData.get('filename') as string;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uniqueName = `${Date.now()}-${file.name}`;
      const filePath = path.join(UPLOAD_DIR, uniqueName);
      await writeFile(filePath, buffer);

      const dbFile = await prisma.uploadedFile.create({
        data: {
          filename: uniqueName,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          path: filePath,
          status: 'processing',
        },
      });

      try {
        const content = await processFile(filePath, file.name);
        await prisma.uploadedFile.update({
          where: { id: dbFile.id },
          data: { status: 'processed', processedContent: content },
        });
        return NextResponse.json({ ...dbFile, status: 'processed' });
      } catch {
        await prisma.uploadedFile.update({
          where: { id: dbFile.id },
          data: { status: 'error' },
        });
        return NextResponse.json({ ...dbFile, status: 'error' });
      }
    }

    if (chunk && uploadId && chunkIndex !== null && totalChunks && filename) {
      const chunkDir = path.join(UPLOAD_DIR, 'chunks', uploadId);
      await mkdir(chunkDir, { recursive: true });

      const buffer = Buffer.from(await chunk.arrayBuffer());
      const chunkPath = path.join(chunkDir, `chunk-${chunkIndex.padStart(6, '0')}`);
      await writeFile(chunkPath, buffer);

      const currentChunk = parseInt(chunkIndex) + 1;
      const total = parseInt(totalChunks);

      if (currentChunk === total) {
        const uniqueName = `${Date.now()}-${filename}`;
        const finalPath = path.join(UPLOAD_DIR, uniqueName);

        const tempPath = path.join(chunkDir, 'assembled');
        for (let i = 0; i < total; i++) {
          const cp = path.join(chunkDir, `chunk-${String(i).padStart(6, '0')}`);
          const chunkData = await import('fs/promises').then((fs) => fs.readFile(cp));
          await appendFile(tempPath, chunkData);
        }
        await rename(tempPath, finalPath);

        const stats = await stat(finalPath);

        const dbFile = await prisma.uploadedFile.create({
          data: {
            filename: uniqueName,
            originalName: filename,
            mimeType: 'application/octet-stream',
            size: stats.size,
            path: finalPath,
            status: 'processing',
          },
        });

        try {
          const content = await processFile(finalPath, filename);
          await prisma.uploadedFile.update({
            where: { id: dbFile.id },
            data: { status: 'processed', processedContent: content },
          });
        } catch {
          await prisma.uploadedFile.update({
            where: { id: dbFile.id },
            data: { status: 'error' },
          });
        }

        const { rm } = await import('fs/promises');
        await rm(chunkDir, { recursive: true, force: true });

        return NextResponse.json({
          completed: true,
          fileId: dbFile.id,
          filename: uniqueName,
        });
      }

      return NextResponse.json({
        completed: false,
        chunkIndex: currentChunk,
        totalChunks: total,
      });
    }

    return NextResponse.json({ error: 'No file or chunk provided' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
