import { NextResponse } from "next/server";

import { completeUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ uploadId: string }>;
  }
) {
  try {
    const { uploadId } = await context.params;
    const record = await completeUpload(uploadId);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
