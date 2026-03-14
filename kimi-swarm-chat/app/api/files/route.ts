import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

export async function GET() {
  const files = await db.uploadedFile.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(serializeBigInt(files));
}
