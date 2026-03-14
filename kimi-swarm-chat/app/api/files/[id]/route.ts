import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeFile } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await db.uploadedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.json({ data: serializeFile(file) });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await db.uploadedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  await db.uploadedFile.delete({ where: { id } });
  await unlink(file.path).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
