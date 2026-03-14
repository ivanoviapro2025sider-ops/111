import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ensureUploadDirs,
  hasAllChunks,
  MAX_FILE_SIZE,
  mergeChunks,
  saveChunk,
} from "@/lib/chunked-upload";
import { serializeBigInt } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureUploadDirs();
  const formData = await request.formData();

  const uploadId = String(formData.get("uploadId") ?? "");
  const fileName = String(formData.get("fileName") ?? "");
  const mimeType = String(formData.get("mimeType") ?? "application/octet-stream");
  const totalChunks = Number(formData.get("totalChunks") ?? 1);
  const chunkIndex = Number(formData.get("chunkIndex") ?? 0);
  const totalSize = Number(formData.get("totalSize") ?? 0);
  const chunkBlob = formData.get("chunk");

  if (!uploadId || !fileName || !chunkBlob || !(chunkBlob instanceof Blob)) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  if (totalSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds max size (${MAX_FILE_SIZE} bytes)` },
      { status: 413 },
    );
  }

  const chunkBuffer = Buffer.from(await chunkBlob.arrayBuffer());
  await saveChunk({
    uploadId,
    chunkIndex,
    chunk: chunkBuffer,
  });

  const done = await hasAllChunks(uploadId, totalChunks);
  if (!done) {
    return NextResponse.json({ done: false, received: chunkIndex });
  }

  const extension = path.extname(fileName).toLowerCase();
  const storedName = `${randomUUID()}${extension}`;
  const fullPath = await mergeChunks(uploadId, totalChunks, storedName);

  const record = await db.uploadedFile.create({
    data: {
      originalName: fileName,
      storedName,
      mimeType,
      extension,
      size: BigInt(totalSize),
      path: fullPath,
      status: "uploaded",
    },
  });

  return NextResponse.json(
    { done: true, file: serializeBigInt(record) },
    { status: 201 },
  );
}
