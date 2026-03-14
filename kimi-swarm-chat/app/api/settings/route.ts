import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_GLOBAL_SETTINGS } from "@/lib/defaults";

const SETTINGS_ID = "global";

export async function GET() {
  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (!settings) {
    const created = await db.settings.create({
      data: {
        id: SETTINGS_ID,
        payload: DEFAULT_GLOBAL_SETTINGS as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json(created.payload);
  }
  return NextResponse.json(settings.payload);
}

export async function PUT(request: Request) {
  const payload = await request.json();
  const upserted = await db.settings.upsert({
    where: { id: SETTINGS_ID },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: { id: SETTINGS_ID, payload: payload as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json(upserted.payload);
}
