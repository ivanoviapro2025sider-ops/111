import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'global', data: '{}' },
      });
    }

    let data = {};
    try {
      data = JSON.parse(settings.data || '{}');
    } catch {}

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    await prisma.settings.upsert({
      where: { id: 'global' },
      create: { id: 'global', data: JSON.stringify(body) },
      update: { data: JSON.stringify(body) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
