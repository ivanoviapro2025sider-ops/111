import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { processFile } from "@/lib/file-processor";

export const runtime = "nodejs";

const schema = z.object({
  fileId: z.string(),
  strategy: z.enum(["full", "chunked", "summary", "map-reduce"]).default("chunked"),
  chunkSize: z.number().int().positive().default(10_000),
  chunkOverlap: z.number().int().nonnegative().default(500),
  maxContextTokens: z.number().int().positive().default(16_000),
  preprocessor: z.enum(["ocr", "transcribe", "extract-frames"]).optional(),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const file = await db.fileRecord.findUnique({ where: { id: payload.fileId } });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await db.fileRecord.update({
      where: { id: file.id },
      data: { status: "PROCESSING" },
    });

    const result = await processFile(
      file.path,
      {
        strategy: payload.strategy,
        chunkSize: payload.chunkSize,
        chunkOverlap: payload.chunkOverlap,
        maxContextTokens: payload.maxContextTokens,
        preprocessor: payload.preprocessor,
      },
      payload.model,
    );

    const updated = await db.fileRecord.update({
      where: { id: file.id },
      data: {
        status: "PROCESSED",
        metadata: result.metadata,
      },
    });

    return NextResponse.json({
      file: {
        ...updated,
        size: Number(updated.size),
      },
      processed: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "File processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
