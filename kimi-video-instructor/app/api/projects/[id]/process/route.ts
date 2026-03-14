import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import prisma from '@/lib/db';
import { runPipeline } from '@/lib/pipeline';
import { getProjectDir } from '@/lib/file-utils';
import { ProjectSettings } from '@/types/project';
import { DEFAULT_PROJECT_SETTINGS } from '@/types/project';

export async function POST(
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

    if (project.status === 'processing') {
      return NextResponse.json(
        { error: 'Pipeline already running' },
        { status: 409 }
      );
    }

    const projectDir = getProjectDir(id);
    const videoPath = path.join(
      projectDir,
      'source' + path.extname(project.videoFileName)
    );

    const settings: ProjectSettings = {
      ...DEFAULT_PROJECT_SETTINGS,
      ...(JSON.parse(project.settings || '{}') as Partial<ProjectSettings>),
    };

    await prisma.project.update({
      where: { id },
      data: { status: 'processing' },
    });

    runPipeline(id, videoPath, settings, async (state) => {
      try {
        await prisma.project.update({
          where: { id },
          data: {
            pipelineState: JSON.stringify(state),
            status: state.error ? 'error' : project.status,
          },
        });
      } catch (err) {
        console.error('Failed to save pipeline state:', err);
      }
    }).catch(async (err) => {
      console.error('Pipeline error:', err);
      try {
        await prisma.project.update({
          where: { id },
          data: { status: 'error' },
        });
      } catch {}
    });

    return NextResponse.json({ success: true, status: 'processing' });
  } catch (error) {
    console.error('POST /api/projects/[id]/process:', error);
    return NextResponse.json(
      { error: 'Failed to start pipeline' },
      { status: 500 }
    );
  }
}
