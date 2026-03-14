import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { initUpload } from '@/lib/chunked-upload';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, fileName, fileSize, mimeType, totalChunks } = body;

    if (!projectId || !fileName || !fileSize || totalChunks == null) {
      return NextResponse.json(
        { error: 'projectId, fileName, fileSize, and totalChunks are required' },
        { status: 400 }
      );
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
