import { NextResponse } from "next/server";

import { writeUploadChunk } from "@/lib/uploads";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ uploadId: string }>;
  }
) {
  try {
    const { uploadId } = await context.params;
    const { searchParams } = new URL(request.url);
    const partNumber = Number.parseInt(searchParams.get("partNumber") ?? "", 10);

    if (!Number.isInteger(partNumber)) {
      throw new Error("partNumber query parameter is required.");
    }

    const result = await writeUploadChunk(uploadId, partNumber, request.body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload chunk.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
