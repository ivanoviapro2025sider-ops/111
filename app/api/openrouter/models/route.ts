import { NextResponse } from 'next/server';
import { fetchModels } from '@/lib/openrouter';

export async function GET() {
  try {
    const models = await fetchModels();
    return NextResponse.json({ data: models });
  } catch (error) {
    console.error('GET /api/openrouter/models error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
