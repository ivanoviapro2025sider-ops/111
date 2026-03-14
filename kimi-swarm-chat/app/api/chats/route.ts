import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const chats = await db.chat.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  return NextResponse.json(chats);
}
