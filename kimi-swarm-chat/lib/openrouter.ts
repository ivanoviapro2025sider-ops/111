import OpenAI from "openai";

const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY || "missing-api-key";
const referer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const openrouter = new OpenAI({
  baseURL,
  apiKey,
  defaultHeaders: {
    "HTTP-Referer": referer,
    "X-Title": "KIMI Swarm Chat Service",
  },
});

export function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
