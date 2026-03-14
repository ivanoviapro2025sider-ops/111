import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = body.apiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/models',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key or request failed' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/settings/test:', error);
    return NextResponse.json(
      { error: 'Failed to test API key' },
      { status: 500 }
    );
  }
}
