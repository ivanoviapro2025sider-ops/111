import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { defaultSampling } from "@/types/agent";
import { defaultFileProcessingOptions } from "@/types/file";

export const runtime = "nodejs";

const defaultSettings = {
  apiKeySet: Boolean(process.env.OPENROUTER_API_KEY),
  baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  title: "KIMI Swarm Chat Service",
  timeoutMs: 120000,
  retryCount: 3,
  retryDelayMs: 1000,
  defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2",
  defaultSampling,
  defaultMaxTurns: 10,
  debugDefault: false,
  maxFileSize: Number(process.env.MAX_FILE_SIZE || `${10 * 1024 * 1024 * 1024}`),
  fileProcessing: defaultFileProcessingOptions,
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  language: "ru",
  theme: "dark",
};

export async function GET() {
  const found = await db.setting.findUnique({ where: { id: "global" } });
  return NextResponse.json({
    data: found?.payload || defaultSettings,
  });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;
  const merged = {
    ...defaultSettings,
    ...payload,
    apiKeySet: Boolean(process.env.OPENROUTER_API_KEY),
  };
  const saved = await db.setting.upsert({
    where: { id: "global" },
    update: { payload: merged as object },
    create: {
      id: "global",
      payload: merged as object,
    },
  });
  return NextResponse.json({ data: saved.payload });
}
