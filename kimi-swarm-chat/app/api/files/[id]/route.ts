import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await db.fileAsset.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...file,
    preview: file.extractedText?.slice(0, 4000) ?? "",
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await db.fileAsset.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await rm(file.path, { force: true });
  await db.fileAsset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
