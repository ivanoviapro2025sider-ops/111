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

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ agents: agents.map((a) => parseAgent(a as unknown as Record<string, unknown>)) });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const agent = await prisma.agent.create({
      data: {
        name: body.name || 'New Agent',
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
        functions: JSON.stringify(body.functions || []),
      },
    });

    return NextResponse.json({ agent: parseAgent(agent as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
