import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import fs from 'fs';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const file = await prisma.uploadedFile.findUnique({ where: { id: params.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    return NextResponse.json({ file });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const file = await prisma.uploadedFile.findUnique({ where: { id: params.id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await prisma.uploadedFile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
