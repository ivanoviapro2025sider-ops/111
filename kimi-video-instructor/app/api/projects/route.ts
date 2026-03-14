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

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    const parsed = projects.map(parseProject);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('GET /api/projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, videoFileName, settings } = body;

    if (!name || !videoFileName) {
      return NextResponse.json(
        { error: 'name and videoFileName are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        videoFileName,
        settings: JSON.stringify(settings || {}),
      },
    });

    return NextResponse.json(parseProject(project));
  } catch (error) {
    console.error('POST /api/projects:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
