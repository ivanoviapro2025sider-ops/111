import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { processFile } from "@/lib/file-processor";
import { serializeBigInt } from "@/lib/serialize";

const schema = z.object({
  fileId: z.string().min(1),
  options: z.object({
    strategy: z.enum(["full", "chunked", "summary", "map-reduce"]).default("map-reduce"),
    chunkSize: z.number().int().positive().default(5000),
    chunkOverlap: z.number().int().min(0).default(300),
    maxContextTokens: z.number().int().positive().default(12000),
    preprocessor: z.enum(["ocr", "transcribe", "extract-frames"]).optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const file = await db.uploadedFile.findUnique({ where: { id: payload.fileId } });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const output = await processFile(file.path, payload.options, file.mimeType);
    const updated = await db.uploadedFile.update({
      where: { id: payload.fileId },
      data: {
        status: "processed",
        processingOutput: output.slice(0, 1_000_000),
        metadata: {
          strategy: payload.options.strategy,
          processedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json(serializeBigInt(updated));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 400 },
    );
  }
}
