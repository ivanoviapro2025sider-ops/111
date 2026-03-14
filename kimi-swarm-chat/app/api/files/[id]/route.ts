import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const file = await db.fileRecord.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...file,
    size: Number(file.size),
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const file = await db.fileRecord.findUnique({ where: { id } });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await db.fileRecord.delete({ where: { id } });

  try {
    await unlink(file.path);
  } catch {
    // Ignore missing file system artifacts.
  }

  return NextResponse.json({ ok: true });
}
