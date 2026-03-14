import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const chats = await db.chatSession.findMany({
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(chats);
}

export async function POST() {
  const chat = await db.chatSession.create({
    data: { title: "New chat" },
  });
  return NextResponse.json(chat, { status: 201 });
}
