import OpenAI from 'openai';

export function createOpenRouterClient(apiKey?: string, baseURL?: string) {
  return new OpenAI({
    baseURL: baseURL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: apiKey || process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'KIMI Swarm Chat Service',
    },
  });
}

const openrouter = createOpenRouterClient();

export default openrouter;

export async function fetchAvailableModels(apiKey?: string, baseURL?: string) {
  const url = `${baseURL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/models`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey || process.env.OPENROUTER_API_KEY || ''}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
  const data = await res.json();
  return data.data || [];
}

export async function testConnection(apiKey: string, baseURL?: string): Promise<boolean> {
  try {
    const url = `${baseURL || 'https://openrouter.ai/api/v1'}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
