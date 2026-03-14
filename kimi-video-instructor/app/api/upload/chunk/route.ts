import { NextRequest, NextResponse } from 'next/server';
import { saveChunk } from '@/lib/chunked-upload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as Blob | null;
    const uploadId = formData.get('uploadId') as string | null;
    const chunkIndexStr = formData.get('chunkIndex') as string | null;

    if (!chunk || !uploadId || chunkIndexStr == null) {
      return NextResponse.json(
        { error: 'chunk, uploadId, and chunkIndex are required' },
        { status: 400 }
      );
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json(
        { error: 'Invalid chunkIndex' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const result = await saveChunk(uploadId, chunkIndex, buffer);

    return NextResponse.json({
      received: result.received,
      total: result.total,
    });
  } catch (error) {
    console.error('POST /api/upload/chunk:', error);
    return NextResponse.json(
      { error: 'Failed to save chunk' },
      { status: 500 }
    );
  }
}
