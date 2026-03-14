import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processFile } from "@/lib/file-processor";
import { defaultFileProcessingOptions, type FileProcessingOptions } from "@/types/file";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    fileId?: string;
    query?: string;
    options?: Partial<FileProcessingOptions>;
  };

  if (!body.fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }
  const file = await db.uploadedFile.findUnique({ where: { id: body.fileId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const options: FileProcessingOptions = {
    ...defaultFileProcessingOptions,
    ...body.options,
  };
  const result = await processFile(file.path, options, body.query);

  await db.uploadedFile.update({
    where: { id: file.id },
    data: {
      status: "processed",
      metadata: {
        ...((file.metadata as Record<string, unknown>) || {}),
        processing: result,
      },
    },
  });

  return NextResponse.json({ data: result });
}
