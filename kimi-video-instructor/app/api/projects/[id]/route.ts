import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

function parseProject(project: {
  id: string;
  name: string;
  description: string | null;
  videoFileName: string;
  videoFileSize: number;
  videoDuration: number;
  videoResolution: string;
  status: string;
  settings: string;
  pipelineState: string;
  instruction: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let settings = {};
  let pipelineState = {};
  let instruction = undefined;
  try {
    settings = JSON.parse(project.settings || '{}');
  } catch {}
  try {
    pipelineState = JSON.parse(project.pipelineState || '{}');
  } catch {}
  try {
    if (project.instruction) {
      instruction = JSON.parse(project.instruction);
    }
  } catch {}
  return {
    ...project,
    settings,
    pipelineState,
    instruction,
  };
}

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

    return NextResponse.json(parseProject(project));
  } catch (error) {
    console.error('GET /api/projects/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowed = [
      'name',
      'description',
      'videoFileName',
      'videoFileSize',
      'videoDuration',
      'videoResolution',
      'status',
      'settings',
      'pipelineState',
      'instruction',
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'settings' || key === 'pipelineState' || key === 'instruction') {
          updateData[key] =
            typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key]);
        } else {
          updateData[key] = body[key];
        }
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(parseProject(project));
  } catch (error) {
    console.error('PUT /api/projects/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
