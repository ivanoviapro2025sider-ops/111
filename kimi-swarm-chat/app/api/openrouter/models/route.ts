import { NextResponse } from "next/server";
import { fetchOpenRouterModels } from "@/lib/openrouter";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          data: [
            { id: "moonshotai/kimi-k2", name: "Kimi K2" },
            { id: "moonshotai/kimi-k2-thinking", name: "Kimi K2 Thinking" },
          ],
          warning: "OPENROUTER_API_KEY is not set; returning fallback model list.",
        },
        { status: 200 },
      );
    }

    const payload = await fetchOpenRouterModels();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch models from OpenRouter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
