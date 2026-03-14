import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const functionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  parameters: z.record(z.string(), z.unknown()).default({}),
  implementation: z.string().default("return null;"),
  isHandoff: z.boolean().default(false),
  handoffTarget: z.string().optional().nullable(),
});

const updateAgentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  model: z.string().optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().optional(),
  color: z.string().optional(),
  samplingConfig: z.record(z.string(), z.unknown()).optional(),
  swarmConfig: z.record(z.string(), z.unknown()).optional(),
  functions: z.array(functionSchema).optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { functions: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const payload = updateAgentSchema.parse(body);

    const updated = await db.$transaction(async (tx) => {
      if (payload.functions) {
        await tx.agentFunction.deleteMany({ where: { agentId: id } });
      }

      return tx.agent.update({
        where: { id },
        data: {
          ...payload,
          functions: payload.functions
            ? {
                create: payload.functions.map((fn) => ({
                  name: fn.name,
                  description: fn.description,
                  parameters: fn.parameters,
                  implementation: fn.implementation,
                  isHandoff: fn.isHandoff,
                  handoffTarget: fn.handoffTarget ?? null,
                })),
              }
            : undefined,
        },
        include: {
          functions: true,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to update agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  await db.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
