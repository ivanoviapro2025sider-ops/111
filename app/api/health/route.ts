import { NextResponse } from "next/server";

import { getSettings } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getSettings();

  return NextResponse.json({
    status: "ok",
    service: "KIMI Swarm Studio",
    configured: {
      openRouterApiKey: settings.openRouter.apiKey.trim().length > 0
    },
    runtime: {
      storage: "local-json"
    }
  });
}
