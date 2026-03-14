import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const modelsUrl = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
    const response = await fetch(
      modelsUrl,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch models', details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/openrouter/models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
