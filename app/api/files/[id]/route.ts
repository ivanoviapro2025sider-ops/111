import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serializeFile } from '@/lib/server-data';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  return NextResponse.json({ file: serializeFile(file) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  await prisma.uploadedFile.delete({ where: { id } });
  await fs.rm(file.path, { force: true });
  return NextResponse.json({ ok: true });
}
