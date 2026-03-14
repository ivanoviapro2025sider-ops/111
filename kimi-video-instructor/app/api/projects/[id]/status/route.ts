import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const send = (data: unknown) => {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    const poll = async () => {
      const p = await prisma.project.findUnique({
        where: { id },
        select: { status: true, pipelineState: true },
      });

      if (!p) {
        return null;
      }

      let pipelineState = {};
      try {
        pipelineState = JSON.parse(p.pipelineState || '{}');
      } catch {}

      send({
        status: p.status,
        pipelineState,
      });

      return p.status;
    };

    await poll();

    const interval = setInterval(async () => {
      try {
        const status = await poll();
        if (
          status === 'review' ||
          status === 'completed' ||
          status === 'error' ||
          status === null
        ) {
          clearInterval(interval);
          writer.close();
        }
      } catch (err) {
        console.error('Status SSE error:', err);
        clearInterval(interval);
        writer.close();
      }
    }, 2000);

    request.signal.addEventListener('abort', () => {
      clearInterval(interval);
      writer.close();
    });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/status:', error);
    return NextResponse.json(
      { error: 'Failed to stream status' },
      { status: 500 }
    );
  }
}
