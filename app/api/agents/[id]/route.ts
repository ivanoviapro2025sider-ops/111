import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serializeAgent } from '@/lib/server-data';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({ where: { id }, include: { functions: true } });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  return NextResponse.json({ agent: serializeAgent(agent) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  await prisma.agentFunction.deleteMany({ where: { agentId: id } });
  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      model: body.model,
      instructions: body.instructions,
      isActive: body.isActive,
      avatar: body.avatar,
      color: body.color,
      temperature: body.temperature,
      topP: body.topP,
      topK: body.topK,
      frequencyPenalty: body.frequencyPenalty,
      presencePenalty: body.presencePenalty,
      repetitionPenalty: body.repetitionPenalty,
      minP: body.minP,
      topA: body.topA,
      maxTokens: body.maxTokens,
      seed: body.seed,
      stop: JSON.stringify(body.stop ?? []),
      responseFormat: body.responseFormat,
      verbosity: body.verbosity,
      maxTurns: body.maxTurns,
      executeTools: body.executeTools,
      stream: body.stream,
      debug: body.debug,
      contextVariables: JSON.stringify(body.contextVariables ?? {}),
      handoffTargetIds: JSON.stringify(body.handoffTargetIds ?? []),
      handoffConditions: body.handoffConditions ?? '',
      toolChoice: body.toolChoice,
      parallelToolCalls: body.parallelToolCalls,
      functions: { create: (body.functions ?? []).map((fn: any) => ({ name: fn.name, description: fn.description ?? '', parameters: JSON.stringify(fn.parameters ?? {}), implementation: fn.implementation ?? 'return { ok: true };', isHandoff: fn.isHandoff ?? false, handoffTarget: fn.handoffTarget ?? null })) },
    },
    include: { functions: true },
  });
  return NextResponse.json({ agent: serializeAgent(agent) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
