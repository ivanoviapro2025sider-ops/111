import { NextResponse } from "next/server";

import { listUploads, startUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET() {
  const uploads = await listUploads();
  return NextResponse.json(uploads);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      originalName?: string;
      size?: number;
      mimeType?: string;
    };

    if (!payload.originalName || typeof payload.size !== "number") {
      throw new Error("originalName and size are required.");
    }

    if (payload.size > 10 * 1024 * 1024 * 1024) {
      throw new Error("Maximum file size is 10 GB.");
    }

    const result = await startUpload({
      originalName: payload.originalName,
      size: payload.size,
      mimeType: payload.mimeType ?? "application/octet-stream"
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
