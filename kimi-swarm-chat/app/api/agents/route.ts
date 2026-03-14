import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createDefaultAgent } from "@/lib/defaults";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  const agents = await db.agent.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const body = await request.json();
  const defaults = createDefaultAgent();
  const created = await db.agent.create({
    data: {
      ...defaults,
      ...body,
      sampling: (body.sampling ?? defaults.sampling) as unknown as Prisma.InputJsonValue,
      swarm: (body.swarm ?? defaults.swarm) as unknown as Prisma.InputJsonValue,
      functions: (body.functions ?? defaults.functions) as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
