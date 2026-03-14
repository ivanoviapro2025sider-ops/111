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

export async function fetchModels(apiKey?: string): Promise<OpenAI.Models.Model[]> {
  const client = apiKey ? createOpenRouterClient(apiKey) : openrouter;
  const response = await client.models.list();
  return response.data;
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const client = createOpenRouterClient(apiKey);
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}
