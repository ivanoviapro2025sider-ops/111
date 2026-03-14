import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const files = await db.fileRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    files.map((file) => ({
      ...file,
      size: Number(file.size),
    })),
  );
}
