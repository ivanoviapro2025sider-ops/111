import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processFileWithStrategy } from "@/lib/file-processor";
import { DEFAULT_MODEL } from "@/lib/utils";
import type { FileProcessingOptions } from "@/types/file";

const DEFAULT_OPTIONS: FileProcessingOptions = {
  strategy: "chunked",
  chunkSize: 8000,
  chunkOverlap: 200,
  maxContextTokens: 32000,
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileId = String(body.fileId ?? "");
    const model = String(body.model ?? DEFAULT_MODEL);
    const options: FileProcessingOptions = {
      ...DEFAULT_OPTIONS,
      ...(body.options ?? {}),
    };

    const file = await db.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await db.fileAsset.update({
      where: { id: fileId },
      data: { status: "processing" },
    });

    const processed = await processFileWithStrategy(file.path, options, model);
    const updated = await db.fileAsset.update({
      where: { id: fileId },
      data: {
        status: "processed",
        extractedText: processed.extractedText.slice(0, 400000),
        summary: processed.summary,
        metadata: {
          ...(processed.metadata ?? {}),
          strategy: options.strategy,
          chunkCount: processed.chunks.length,
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
