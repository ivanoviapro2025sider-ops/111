import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeFile } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  const files = await db.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: files.map(serializeFile) });
}
