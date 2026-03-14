import { NextRequest, NextResponse } from 'next/server';
import { fetchAvailableModels, testConnection } from '@/lib/openrouter';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.nextUrl.searchParams.get('apiKey') || undefined;
    const models = await fetchAvailableModels(apiKey);
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, baseUrl } = await request.json();
    const ok = await testConnection(apiKey, baseUrl);
    return NextResponse.json({ success: ok });
  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
