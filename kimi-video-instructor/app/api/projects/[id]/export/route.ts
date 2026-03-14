import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { exportInstruction } from '@/lib/exporter';
import { Instruction } from '@/types/instruction';
import { readFile } from 'fs/promises';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const format = (body.format || 'md') as 'md' | 'html';

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.instruction) {
      return NextResponse.json(
        { error: 'No instruction generated yet' },
        { status: 400 }
      );
    }

    const instruction = JSON.parse(project.instruction) as Instruction;

    const options = {
      includeScreenshots: body.includeScreenshots ?? true,
      includeAnnotations: body.includeAnnotations ?? true,
      includeTimestamps: body.includeTimestamps ?? true,
      includeTips: body.includeTips ?? true,
      includeTableOfContents: body.includeTableOfContents ?? true,
      includeMetadata: body.includeMetadata ?? true,
    };

    const filePath = await exportInstruction(id, instruction, format, options);

    const content = await readFile(filePath, 'utf-8');
    const contentType =
      format === 'html' ? 'text/html' : 'text/markdown';
    const ext = format === 'html' ? 'html' : 'md';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="instruction.${ext}"`,
      },
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/export:', error);
    return NextResponse.json(
      { error: 'Failed to export instruction' },
      { status: 500 }
    );
  }
}
