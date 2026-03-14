import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { saveChunk, assembleChunks, ensureUploadDir } from '@/lib/chunked-upload';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const chunkIndex = formData.get('chunkIndex') as string | null;
      const totalChunks = formData.get('totalChunks') as string | null;
      const fileId = (formData.get('fileId') as string) || uuidv4();
      const fileName = formData.get('fileName') as string || file?.name || 'unknown';
      const totalSize = parseInt(formData.get('totalSize') as string || '0');
      const mimeType = formData.get('mimeType') as string || file?.type || 'application/octet-stream';

      if (chunkIndex !== null && totalChunks !== null) {
        const buffer = file ? Buffer.from(await file.arrayBuffer()) : Buffer.alloc(0);
        await saveChunk(fileId, parseInt(chunkIndex), buffer);

        const currentChunk = parseInt(chunkIndex);
        const total = parseInt(totalChunks);

        if (currentChunk === total - 1) {
          const finalPath = await assembleChunks(fileId, total, fileName);

          const uploadedFile = await prisma.uploadedFile.create({
            data: {
              id: fileId,
              name: `${fileId}${path.extname(fileName)}`,
              originalName: fileName,
              mimeType,
              size: totalSize,
              path: finalPath,
              status: 'pending',
            },
          });

          return NextResponse.json({ file: uploadedFile, complete: true });
        }

        return NextResponse.json({
          fileId,
          chunkIndex: currentChunk,
          complete: false,
          progress: ((currentChunk + 1) / total) * 100,
        });
      }

      if (file) {
        ensureUploadDir();
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = path.extname(file.name);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(UPLOAD_DIR, storedName);
        fs.writeFileSync(filePath, buffer);

        const uploadedFile = await prisma.uploadedFile.create({
          data: {
            id: fileId,
            name: storedName,
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            path: filePath,
            status: 'pending',
          },
        });

        return NextResponse.json({ file: uploadedFile, complete: true }, { status: 201 });
      }

      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
