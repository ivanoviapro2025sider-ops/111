import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serializeSettings } from '@/lib/server-data';

export async function GET() {
  const settings = await prisma.globalSettings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } });
  return NextResponse.json({ settings: serializeSettings(settings) });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const settings = await prisma.globalSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global', ...body, globalContextVariables: JSON.stringify(body.globalContextVariables ?? {}) },
    update: { ...body, globalContextVariables: JSON.stringify(body.globalContextVariables ?? {}) },
  });
  return NextResponse.json({ settings: serializeSettings(settings) });
}
