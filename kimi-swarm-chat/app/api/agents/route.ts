import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mergeSampling, mergeSwarm } from "@/lib/defaults";

const agentFunctionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
  implementation: z.string().default(""),
  isHandoff: z.boolean().default(false),
  handoffTarget: z.string().optional(),
});

const agentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  model: z.string().default("moonshotai/kimi-k2"),
  instructions: z.string().min(1),
  isActive: z.boolean().default(true),
  avatar: z.string().default("🤖"),
  color: z.string().default("#6366f1"),
  sampling: z.record(z.string(), z.unknown()).optional(),
  swarm: z.record(z.string(), z.unknown()).optional(),
  functions: z.array(agentFunctionSchema).default([]),
});

export async function GET() {
  const agents = await db.agent.findMany({
    include: { functions: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = agentSchema.parse(payload);

    const agent = await db.agent.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        model: parsed.model,
        instructions: parsed.instructions,
        isActive: parsed.isActive,
        avatar: parsed.avatar,
        color: parsed.color,
        sampling: mergeSampling(parsed.sampling as never),
        swarm: mergeSwarm(parsed.swarm as never),
        functions: {
          create: parsed.functions.map((fn) => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
            implementation: fn.implementation,
            isHandoff: fn.isHandoff,
            handoffTarget: fn.handoffTarget,
          })),
        },
      },
      include: { functions: true },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create agent" },
      { status: 400 },
    );
  }
}
