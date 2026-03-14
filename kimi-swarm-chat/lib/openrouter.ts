import OpenAI from "openai";

const baseURL =
  process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

const openrouter = new OpenAI({
  baseURL,
  apiKey: apiKey || "missing-openrouter-key",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "KIMI Swarm Chat Service",
  },
});

export async function fetchOpenRouterModels() {
  const response = await fetch(`${baseURL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "KIMI Swarm Chat Service",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch models: ${response.status} ${text}`);
  }

  return response.json();
}

export default openrouter;
