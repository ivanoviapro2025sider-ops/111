import OpenAI from 'openai';

export function createOpenRouterClient(apiKey?: string) {
  return new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'KIMI Video Instructor',
    },
  });
}

let _client: OpenAI | null = null;
export function getOpenRouter(): OpenAI {
  if (!_client) {
    _client = createOpenRouterClient();
  }
  return _client;
}

export function resetClient() {
  _client = null;
}
