import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defaultGlobalSettings } from "@/lib/defaults";

const settingsSchema = z.object({
  api: z.object({
    baseUrl: z.string().url(),
    referer: z.string(),
    title: z.string(),
    timeoutMs: z.number().int().positive(),
    retryCount: z.number().int().min(0).max(10),
    retryDelay: z.number().int().min(0),
  }),
  defaults: z.object({
    model: z.string().min(1),
    sampling: z.record(z.string(), z.unknown()),
  }),
  swarm: z.object({
    initialAgentId: z.string().nullable(),
    maxTurns: z.number().int().positive().nullable(),
    contextVariables: z.record(z.string(), z.unknown()),
    debug: z.boolean(),
  }),
  files: z.object({
    maxFileSize: z.number().int().positive(),
    strategy: z.enum(["full", "chunked", "summary", "map-reduce"]),
    chunkSize: z.number().int().positive(),
    uploadDir: z.string(),
    autoCleanupHours: z.number().int().positive(),
  }),
  interface: z.object({
    theme: z.enum(["light", "dark", "system"]),
    language: z.enum(["ru", "en"]),
    fontSize: z.number().int().min(10).max(24),
    density: z.enum(["comfortable", "compact"]),
    showDebugInfo: z.boolean(),
  }),
});

const SETTINGS_KEY = "global";

export async function GET() {
  const stored = await db.globalSetting.findUnique({ where: { key: SETTINGS_KEY } });
  return NextResponse.json(stored?.value ?? defaultGlobalSettings);
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const parsed = settingsSchema.parse(payload);
    const result = await db.globalSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: parsed },
      create: {
        key: SETTINGS_KEY,
        value: parsed,
      },
    });

    return NextResponse.json(result.value);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid settings payload" },
      { status: 400 },
    );
  }
}
