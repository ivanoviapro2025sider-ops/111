import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/models',
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
