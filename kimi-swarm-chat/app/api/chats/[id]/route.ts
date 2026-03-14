import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const chat = await db.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      agent: true,
    },
  });
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  return NextResponse.json(chat);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.chatSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
