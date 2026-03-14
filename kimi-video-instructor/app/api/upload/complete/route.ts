import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { completeUpload, getUploadSession } from '@/lib/chunked-upload';
import { getVideoInfo } from '@/lib/video-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json(
        { error: 'uploadId is required' },
        { status: 400 }
      );
    }

    const session = getUploadSession(uploadId);
    if (!session) {
      return NextResponse.json(
        { error: 'Upload session not found' },
        { status: 404 }
      );
    }

    const videoPath = await completeUpload(uploadId, session.projectId);
    const videoInfo = await getVideoInfo(videoPath);

    const resolution = `${videoInfo.width}x${videoInfo.height}`;

    await prisma.project.update({
      where: { id: session.projectId },
      data: {
        status: 'uploaded',
        videoFileName: session.fileName,
        videoFileSize: session.fileSize,
        videoDuration: videoInfo.duration,
        videoResolution: resolution,
      },
    });

    return NextResponse.json({
      success: true,
      projectId: session.projectId,
      videoPath,
      videoInfo: {
        duration: videoInfo.duration,
        width: videoInfo.width,
        height: videoInfo.height,
        resolution,
      },
    });
  } catch (error) {
    console.error('POST /api/upload/complete:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}
