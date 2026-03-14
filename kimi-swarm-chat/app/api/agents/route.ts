import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_SAMPLING_CONFIG, DEFAULT_SWARM_CONFIG } from "@/lib/utils";

export const runtime = "nodejs";

const functionSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  parameters: z.record(z.string(), z.unknown()).default({}),
  implementation: z.string().default("return null;"),
  isHandoff: z.boolean().default(false),
  handoffTarget: z.string().optional().nullable(),
});

const agentSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  model: z.string().default("moonshotai/kimi-k2"),
  instructions: z.string().default("You are a helpful assistant."),
  isActive: z.boolean().default(true),
  avatar: z.string().default("Bot"),
  color: z.string().default("#6366f1"),
  samplingConfig: z.record(z.string(), z.unknown()).default(DEFAULT_SAMPLING_CONFIG),
  swarmConfig: z.record(z.string(), z.unknown()).default(DEFAULT_SWARM_CONFIG),
  functions: z.array(functionSchema).default([]),
});

export async function GET() {
  const agents = await db.agent.findMany({
    include: {
      functions: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(agents);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = agentSchema.parse(body);

    const created = await db.agent.create({
      data: {
        name: payload.name,
        description: payload.description,
        model: payload.model,
        instructions: payload.instructions,
        isActive: payload.isActive,
        avatar: payload.avatar,
        color: payload.color,
        samplingConfig: payload.samplingConfig,
        swarmConfig: payload.swarmConfig,
        functions: {
          create: payload.functions.map((fn) => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
            implementation: fn.implementation,
            isHandoff: fn.isHandoff,
            handoffTarget: fn.handoffTarget ?? null,
          })),
        },
      },
      include: { functions: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to create agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
