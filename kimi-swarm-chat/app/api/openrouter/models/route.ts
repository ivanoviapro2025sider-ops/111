import { NextResponse } from "next/server";
import { fetchOpenRouterModels } from "@/lib/openrouter";

export async function GET() {
  try {
    const models = await fetchOpenRouterModels();
    return NextResponse.json(models);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
