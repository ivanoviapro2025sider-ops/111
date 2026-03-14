import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "KIMI Swarm Chat Service",
  },
});

export async function fetchOpenRouterModels() {
  const response = await fetch(
    `${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/models`,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter models request failed: ${response.status} ${body}`);
  }

  return response.json();
}

export default openrouter;
