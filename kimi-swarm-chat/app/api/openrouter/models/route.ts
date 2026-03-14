import { NextResponse } from "next/server";
import type { OpenRouterModelsResponse } from "@/types/openrouter";

export const runtime = "nodejs";

const fallbackModels = [
  { id: "moonshotai/kimi-k2" },
  { id: "moonshotai/kimi-k2-thinking" },
  { id: "openai/gpt-4o-mini" },
];

export async function GET() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ data: fallbackModels });
    }
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "KIMI Swarm Chat Service",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`OpenRouter models request failed: ${response.status}`);
    }
    const payload = (await response.json()) as OpenRouterModelsResponse;
    return NextResponse.json({ data: payload.data || fallbackModels });
  } catch {
    return NextResponse.json({ data: fallbackModels });
  }
}
