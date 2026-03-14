import { NextResponse } from "next/server";
import { DEFAULT_MODEL } from "@/lib/openrouter";
import type { OpenRouterModelsResponse } from "@/types/openrouter";

const fallbackModels: OpenRouterModelsResponse = {
  data: [
    {
      id: "moonshotai/kimi-k2",
      name: "Kimi K2",
      context_length: 128000,
      pricing: { prompt: "0.6", completion: "2.5" },
      description: "Default Kimi K2 model",
    },
    {
      id: "moonshotai/kimi-k2-thinking",
      name: "Kimi K2 Thinking",
      context_length: 128000,
      pricing: { prompt: "1.2", completion: "4.8" },
      description: "Reasoning-focused Kimi K2 variant",
    },
  ],
};

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({
      ...fallbackModels,
      default: DEFAULT_MODEL,
      warning: "OPENROUTER_API_KEY is missing. Using fallback list.",
    });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "KIMI Swarm Chat Service",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    return NextResponse.json({ ...data, default: DEFAULT_MODEL });
  } catch (error) {
    return NextResponse.json(
      {
        ...fallbackModels,
        default: DEFAULT_MODEL,
        warning: error instanceof Error ? error.message : "Cannot fetch models",
      },
      { status: 200 },
    );
  }
}
