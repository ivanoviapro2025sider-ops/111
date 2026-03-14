import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const files = await db.fileAsset.findMany({
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json(files);
}
