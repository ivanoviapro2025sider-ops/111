import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeUpload, getChunkProgress, storeChunk } from "@/lib/chunked-upload";
import { serializeFile } from "@/lib/serializers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const chunk = formData.get("chunk");
  const uploadId = String(formData.get("uploadId") || "");
  const fileName = String(formData.get("fileName") || "");
  const mimeType = String(formData.get("mimeType") || "application/octet-stream");
  const size = Number(formData.get("size") || 0);
  const totalChunks = Number(formData.get("totalChunks") || 1);
  const chunkIndex = Number(formData.get("chunkIndex") || 0);
  const finalize = String(formData.get("finalize") || "false") === "true";

  if (!(chunk instanceof File) || !uploadId || !fileName) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  const maxFileSize = Number(process.env.MAX_FILE_SIZE || `${10 * 1024 * 1024 * 1024}`);
  if (size > maxFileSize) {
    return NextResponse.json(
      { error: `File exceeds max size (${maxFileSize} bytes)` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await chunk.arrayBuffer());
  await storeChunk({
    uploadId,
    fileName,
    chunkIndex,
    totalChunks,
    chunk: buffer,
  });
  const progress = await getChunkProgress(uploadId, totalChunks);

  if (!finalize || !progress.isComplete) {
    return NextResponse.json({ progress });
  }

  const finalPath = await completeUpload({
    uploadId,
    fileName,
    totalChunks,
  });

  const created = await db.uploadedFile.create({
    data: {
      originalName: fileName,
      storedName: path.basename(finalPath),
      mimeType,
      size: BigInt(size),
      status: "uploaded",
      path: finalPath,
      metadata: {
        uploadId,
        totalChunks,
      },
    },
  });

  return NextResponse.json({ file: serializeFile(created) }, { status: 201 });
}
