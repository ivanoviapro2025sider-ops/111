import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeAgent } from "@/lib/serializers";
import { defaultSampling, defaultSwarm } from "@/types/agent";

export const runtime = "nodejs";

export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ data: agents.map(serializeAgent) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const created = await db.agent.create({
    data: {
      name,
      description: String(body.description || ""),
      model: String(body.model || process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2"),
      instructions: String(body.instructions || "You are a helpful KIMI agent."),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      avatar: String(body.avatar || "🤖"),
      color: String(body.color || "#6366f1"),
      sampling: (body.sampling ?? defaultSampling) as object,
      swarm: (body.swarm ?? defaultSwarm) as object,
      functions: (body.functions ?? []) as object,
    },
  });

  return NextResponse.json({ data: serializeAgent(created) }, { status: 201 });
}
