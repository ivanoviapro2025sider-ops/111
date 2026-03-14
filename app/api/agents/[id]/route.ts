import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

function parseAgent(agent: Record<string, unknown>) {
  return {
    ...agent,
    stop: JSON.parse((agent.stop as string) || '[]'),
    contextVariables: JSON.parse((agent.contextVariables as string) || '{}'),
    handoffTargets: JSON.parse((agent.handoffTargets as string) || '[]'),
    functions: JSON.parse((agent.functions as string) || '[]'),
  };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({ agent: parseAgent(agent as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    const directFields = [
      'name', 'description', 'model', 'instructions', 'isActive', 'avatar', 'color',
      'temperature', 'topP', 'topK', 'frequencyPenalty', 'presencePenalty', 'repetitionPenalty',
      'minP', 'topA', 'maxTokens', 'seed', 'responseFormat', 'maxTurns', 'executeTools',
      'stream', 'debug', 'handoffConditions', 'toolChoice', 'parallelToolCalls',
    ];

    for (const field of directFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    if (body.stop !== undefined) data.stop = JSON.stringify(body.stop);
    if (body.contextVariables !== undefined) data.contextVariables = JSON.stringify(body.contextVariables);
    if (body.handoffTargets !== undefined) data.handoffTargets = JSON.stringify(body.handoffTargets);
    if (body.functions !== undefined) data.functions = JSON.stringify(body.functions);

    const agent = await prisma.agent.update({ where: { id: params.id }, data });
    return NextResponse.json({ agent: parseAgent(agent as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.agent.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
