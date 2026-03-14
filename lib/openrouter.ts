import OpenAI from 'openai';
import type { OpenRouterModel } from '@/types/openrouter';
import { prisma } from '@/lib/db';

async function getSettings() {
  return prisma.globalSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  });
}

export async function getOpenRouterClient() {
  const settings = await getSettings();
  const apiKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new OpenAI({
    baseURL: settings.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey,
    timeout: settings.timeout,
    defaultHeaders: {
      'HTTP-Referer': settings.httpReferer || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': settings.xTitle || 'KIMI Swarm Chat Service',
    },
  });
}

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const settings = await getSettings();
  const apiKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  const baseUrl = settings.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    return [
      { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: 'Default Moonshot AI model', context_length: 131072, pricing: { prompt: '0.6', completion: '2.5' } },
      { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', description: 'Reasoning-oriented variant', context_length: 131072, pricing: { prompt: '0.8', completion: '3.0' } },
    ];
  }

  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': settings.httpReferer || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': settings.xTitle || 'KIMI Swarm Chat Service',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed: ${response.status}`);
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };
  return data.data ?? [];
}
