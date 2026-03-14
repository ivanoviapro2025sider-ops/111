import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureGlobalSettings } from "@/lib/settings";

export const runtime = "nodejs";

const updateSettingsSchema = z.object({
  openRouterApiKey: z.string().optional().nullable(),
  openRouterBaseUrl: z.string().optional(),
  httpReferer: z.string().optional(),
  xTitle: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  retryDelayMs: z.number().int().nonnegative().optional(),
  defaultModel: z.string().optional(),
  defaultSamplingConfig: z.record(z.string(), z.unknown()).optional(),
  defaultSwarmConfig: z.record(z.string(), z.unknown()).optional(),
  fileProcessingConfig: z.record(z.string(), z.unknown()).optional(),
  interfaceConfig: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const settings = await ensureGlobalSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const payload = updateSettingsSchema.parse(body);
    await ensureGlobalSettings();

    const updated = await db.setting.update({
      where: { id: "global" },
      data: payload,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to update settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
