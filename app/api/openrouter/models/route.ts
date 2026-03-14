import { NextResponse } from 'next/server';
import { fetchModels } from '@/lib/openrouter';

export async function GET() {
  try {
    const data = await fetchModels();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
