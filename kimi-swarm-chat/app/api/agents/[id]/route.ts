import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeAgent } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ data: serializeAgent(agent) });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const updated = await db.agent.update({
    where: { id },
    data: {
      name: body.name ? String(body.name) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      model: body.model !== undefined ? String(body.model) : undefined,
      instructions: body.instructions !== undefined ? String(body.instructions) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      avatar: body.avatar !== undefined ? String(body.avatar) : undefined,
      color: body.color !== undefined ? String(body.color) : undefined,
      sampling: body.sampling as object | undefined,
      swarm: body.swarm as object | undefined,
      functions: body.functions as object | undefined,
    },
  });

  return NextResponse.json({ data: serializeAgent(updated) });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await db.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
