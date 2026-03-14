import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const file = await db.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json(serializeBigInt(file));
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const file = await db.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await db.uploadedFile.delete({ where: { id } });
  await fs.rm(file.path, { force: true }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
