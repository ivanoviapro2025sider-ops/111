import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { initUpload } from '@/lib/chunked-upload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { projectId, fileName, fileSize, mimeType, totalChunks, name, description } = body;

    if (!fileName || !fileSize || totalChunks == null) {
      return NextResponse.json(
        { error: 'fileName, fileSize, and totalChunks are required' },
        { status: 400 }
      );
    }

    if (!projectId) {
      const project = await prisma.project.create({
        data: {
          name: name || fileName.replace(/\.[^/.]+$/, ''),
          description: description || null,
          videoFileName: fileName,
          status: 'uploading',
        },
      });
      projectId = project.id;
    }

    const uploadId = uuidv4();
    const session = await initUpload(
      uploadId,
      projectId,
      fileName,
      Number(fileSize),
      mimeType || 'video/mp4',
      Number(totalChunks)
    );

    return NextResponse.json({
      uploadId: session.uploadId,
      projectId: session.projectId,
      totalChunks: session.totalChunks,
    });
  } catch (error) {
    console.error('POST /api/upload/init:', error);
    return NextResponse.json(
      { error: 'Failed to initialize upload' },
      { status: 500 }
    );
  }
}
