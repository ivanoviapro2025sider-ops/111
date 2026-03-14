import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: { functions: true },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = agents.map(agent => ({
      ...agent,
      stop: JSON.parse(agent.stop),
      contextVariables: JSON.parse(agent.contextVariables),
      handoffTargets: JSON.parse(agent.handoffTargets),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        description: body.description || '',
        model: body.model || 'moonshotai/kimi-k2',
        instructions: body.instructions || '',
        isActive: body.isActive ?? true,
        avatar: body.avatar || 'bot',
        color: body.color || '#6366f1',
        temperature: body.temperature ?? 1.0,
        topP: body.topP ?? 1.0,
        topK: body.topK ?? 0,
        frequencyPenalty: body.frequencyPenalty ?? 0.0,
        presencePenalty: body.presencePenalty ?? 0.0,
        repetitionPenalty: body.repetitionPenalty ?? 1.0,
        minP: body.minP ?? 0.0,
        topA: body.topA ?? 0.0,
        maxTokens: body.maxTokens ?? 4096,
        seed: body.seed ?? null,
        stop: JSON.stringify(body.stop || []),
        responseFormat: body.responseFormat || 'text',
        maxTurns: body.maxTurns ?? 0,
        executeTools: body.executeTools ?? true,
        stream: body.stream ?? true,
        debug: body.debug ?? false,
        contextVariables: JSON.stringify(body.contextVariables || {}),
        handoffTargets: JSON.stringify(body.handoffTargets || []),
        handoffConditions: body.handoffConditions || '',
        toolChoice: body.toolChoice || 'auto',
        parallelToolCalls: body.parallelToolCalls ?? true,
        functions: body.functions?.length ? {
          create: body.functions.map((fn: Record<string, unknown>) => ({
            name: fn.name as string,
            description: (fn.description as string) || '',
            parameters: JSON.stringify(fn.parameters || {}),
            implementation: (fn.implementation as string) || '',
            isHandoff: (fn.isHandoff as boolean) || false,
            handoffTarget: (fn.handoffTarget as string) || null,
          })),
        } : undefined,
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
    console.error('POST /api/agents error:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
