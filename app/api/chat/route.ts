import { NextResponse } from "next/server";

import { runSwarm } from "@/lib/swarm";
import { chatRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = chatRequestSchema.parse(payload);
    const result = await runSwarm(parsed);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run swarm.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
