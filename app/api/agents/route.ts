import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureSeedData } from '@/lib/swarm';
import { serializeAgent } from '@/lib/server-data';

export async function GET() {
  await ensureSeedData();
  const agents = await prisma.agent.findMany({ include: { functions: true }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ agents: agents.map(serializeAgent) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await prisma.agent.create({
    data: {
      name: body.name,
      description: body.description ?? '',
      model: body.model ?? 'moonshotai/kimi-k2',
      instructions: body.instructions ?? 'You are a helpful assistant.',
      isActive: body.isActive ?? true,
      avatar: body.avatar ?? 'Bot',
      color: body.color ?? '#6366f1',
      temperature: body.temperature ?? 1,
      topP: body.topP ?? 1,
      topK: body.topK ?? 0,
      frequencyPenalty: body.frequencyPenalty ?? 0,
      presencePenalty: body.presencePenalty ?? 0,
      repetitionPenalty: body.repetitionPenalty ?? 1,
      minP: body.minP ?? 0,
      topA: body.topA ?? 0,
      maxTokens: body.maxTokens ?? 4096,
      seed: body.seed ?? null,
      stop: JSON.stringify(body.stop ?? []),
      responseFormat: body.responseFormat ?? 'text',
      verbosity: body.verbosity ?? 'medium',
      maxTurns: body.maxTurns ?? null,
      executeTools: body.executeTools ?? true,
      stream: body.stream ?? true,
      debug: body.debug ?? false,
      contextVariables: JSON.stringify(body.contextVariables ?? {}),
      handoffTargetIds: JSON.stringify(body.handoffTargetIds ?? []),
      handoffConditions: body.handoffConditions ?? '',
      toolChoice: body.toolChoice ?? 'auto',
      parallelToolCalls: body.parallelToolCalls ?? true,
      functions: { create: (body.functions ?? []).map((fn: any) => ({ name: fn.name, description: fn.description ?? '', parameters: JSON.stringify(fn.parameters ?? {}), implementation: fn.implementation ?? 'return { ok: true };', isHandoff: fn.isHandoff ?? false, handoffTarget: fn.handoffTarget ?? null })) },
    },
    include: { functions: true },
  });
  return NextResponse.json({ agent: serializeAgent(created) }, { status: 201 });
}
