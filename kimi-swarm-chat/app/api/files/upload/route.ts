import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assembleChunks,
  ensureUploadDirectories,
  getUploadPath,
  hasChunk,
  listIncompleteUploads,
  MAX_FILE_SIZE,
  saveChunk,
} from "@/lib/chunked-upload";

export const runtime = "nodejs";

export async function GET() {
  const uploads = await listIncompleteUploads();
  return NextResponse.json({
    uploads,
    maxFileSize: MAX_FILE_SIZE,
    chunkSize: 5 * 1024 * 1024,
  });
}

export async function POST(req: Request) {
  try {
    await ensureUploadDirectories();
    const formData = await req.formData();

    const uploadId = String(formData.get("uploadId") || "");
    const fileName = String(formData.get("fileName") || "");
    const mimeType = String(formData.get("mimeType") || "application/octet-stream");
    const totalSize = Number(formData.get("totalSize") || 0);
    const totalChunks = Number(formData.get("totalChunks") || 0);
    const chunkIndex = Number(formData.get("chunkIndex") || 0);
    const chunkBlob = formData.get("chunk");

    if (!uploadId || !fileName || Number.isNaN(totalChunks)) {
      return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
    }

    if (totalSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds max size ${MAX_FILE_SIZE}` },
        { status: 413 },
      );
    }

    if (!(chunkBlob instanceof Blob)) {
      return NextResponse.json({ error: "Chunk payload is missing" }, { status: 400 });
    }

    if (!(await hasChunk(uploadId, chunkIndex))) {
      const buffer = Buffer.from(await chunkBlob.arrayBuffer());
      await saveChunk(uploadId, chunkIndex, buffer);
    }

    const uploadedChunks = chunkIndex + 1;
    const isComplete = uploadedChunks >= totalChunks;

    if (!isComplete) {
      return NextResponse.json({
        uploadId,
        uploadedChunks,
        totalChunks,
        status: "UPLOADING",
      });
    }

    const targetPath = getUploadPath(fileName);
    await assembleChunks(uploadId, totalChunks, targetPath);

    const created = await db.fileRecord.create({
      data: {
        fileName: path.basename(targetPath),
        originalName: fileName,
        mimeType,
        size: BigInt(totalSize),
        extension: path.extname(fileName).toLowerCase(),
        path: targetPath,
        status: "UPLOADED",
      },
    });

    return NextResponse.json({
      uploadId,
      file: {
        ...created,
        size: Number(created.size),
      },
      status: "UPLOADED",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
