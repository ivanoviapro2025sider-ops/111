import OpenAI from "openai";

const baseURL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY ?? "";

const openrouter = new OpenAI({
  baseURL,
  apiKey,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "KIMI Swarm Chat Service",
  },
});

export function assertOpenRouterConfig() {
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
}

export const DEFAULT_MODEL =
  process.env.OPENROUTER_DEFAULT_MODEL ?? "moonshotai/kimi-k2";

export default openrouter;
