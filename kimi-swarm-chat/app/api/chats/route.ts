import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const chats = await db.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      agent: true,
    },
  });
  return NextResponse.json(chats);
}
