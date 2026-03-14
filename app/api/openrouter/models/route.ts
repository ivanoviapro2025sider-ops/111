import { NextResponse } from 'next/server';
import { listOpenRouterModels } from '@/lib/openrouter';

export async function GET() {
  try {
    const models = await listOpenRouterModels();
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch models' }, { status: 500 });
  }
}
