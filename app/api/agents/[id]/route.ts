import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: { functions: true },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...agent,
      stop: JSON.parse(agent.stop),
      contextVariables: JSON.parse(agent.contextVariables),
      handoffTargets: JSON.parse(agent.handoffTargets),
    });
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (body.functions !== undefined) {
      await prisma.agentFunction.deleteMany({
        where: { agentId: params.id },
      });
    }

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.model !== undefined && { model: body.model }),
        ...(body.instructions !== undefined && { instructions: body.instructions }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.avatar !== undefined && { avatar: body.avatar }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.temperature !== undefined && { temperature: body.temperature }),
        ...(body.topP !== undefined && { topP: body.topP }),
        ...(body.topK !== undefined && { topK: body.topK }),
        ...(body.frequencyPenalty !== undefined && { frequencyPenalty: body.frequencyPenalty }),
        ...(body.presencePenalty !== undefined && { presencePenalty: body.presencePenalty }),
        ...(body.repetitionPenalty !== undefined && { repetitionPenalty: body.repetitionPenalty }),
        ...(body.minP !== undefined && { minP: body.minP }),
        ...(body.topA !== undefined && { topA: body.topA }),
        ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
        ...(body.seed !== undefined && { seed: body.seed }),
        ...(body.stop !== undefined && { stop: JSON.stringify(body.stop) }),
        ...(body.responseFormat !== undefined && { responseFormat: body.responseFormat }),
        ...(body.maxTurns !== undefined && { maxTurns: body.maxTurns }),
        ...(body.executeTools !== undefined && { executeTools: body.executeTools }),
        ...(body.stream !== undefined && { stream: body.stream }),
        ...(body.debug !== undefined && { debug: body.debug }),
        ...(body.contextVariables !== undefined && { contextVariables: JSON.stringify(body.contextVariables) }),
        ...(body.handoffTargets !== undefined && { handoffTargets: JSON.stringify(body.handoffTargets) }),
        ...(body.handoffConditions !== undefined && { handoffConditions: body.handoffConditions }),
        ...(body.toolChoice !== undefined && { toolChoice: body.toolChoice }),
        ...(body.parallelToolCalls !== undefined && { parallelToolCalls: body.parallelToolCalls }),
        ...(body.functions?.length ? {
          functions: {
            create: body.functions.map((fn: Record<string, unknown>) => ({
              name: fn.name as string,
              description: (fn.description as string) || '',
              parameters: JSON.stringify(fn.parameters || {}),
              implementation: (fn.implementation as string) || '',
              isHandoff: (fn.isHandoff as boolean) || false,
              handoffTarget: (fn.handoffTarget as string) || null,
            })),
          },
        } : {}),
      },
      include: { functions: true },
    });

    return NextResponse.json({
      ...agent,
      stop: JSON.parse(agent.stop),
      contextVariables: JSON.parse(agent.contextVariables),
      handoffTargets: JSON.parse(agent.handoffTargets),
    });
  } catch (error) {
    console.error('PUT /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.agent.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
