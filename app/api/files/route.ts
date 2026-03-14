import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const files = await prisma.uploadedFile.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}
