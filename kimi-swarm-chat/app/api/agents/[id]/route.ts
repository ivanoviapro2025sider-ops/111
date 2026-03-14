import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { mergeSampling, mergeSwarm } from "@/lib/defaults";

const updateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  model: z.string().default("moonshotai/kimi-k2"),
  instructions: z.string().min(1),
  isActive: z.boolean().default(true),
  avatar: z.string().default("🤖"),
  color: z.string().default("#6366f1"),
  sampling: z.record(z.string(), z.unknown()).optional(),
  swarm: z.record(z.string(), z.unknown()).optional(),
  functions: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.string(), z.unknown()),
        implementation: z.string(),
        isHandoff: z.boolean(),
        handoffTarget: z.string().optional(),
      }),
    )
    .default([]),
});

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { functions: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const payload = updateSchema.parse(await request.json());

    const updated = await db.$transaction(async (tx) => {
      await tx.agentFunction.deleteMany({ where: { agentId: id } });
      return tx.agent.update({
        where: { id },
        data: {
          name: payload.name,
          description: payload.description,
          model: payload.model,
          instructions: payload.instructions,
          isActive: payload.isActive,
          avatar: payload.avatar,
          color: payload.color,
          sampling: mergeSampling(payload.sampling as never),
          swarm: mergeSwarm(payload.swarm as never),
          functions: {
            create: payload.functions.map((fn) => ({
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
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update agent" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    await db.agent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
