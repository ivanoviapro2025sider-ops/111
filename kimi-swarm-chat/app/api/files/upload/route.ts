import { extname } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assembleChunks,
  persistChunk,
  saveDirectUpload,
  type ChunkMetadata,
} from "@/lib/chunked-upload";

export const runtime = "nodejs";

function parseChunkMetadata(formData: FormData): ChunkMetadata {
  return {
    uploadId: String(formData.get("uploadId") ?? ""),
    chunkIndex: Number(formData.get("chunkIndex") ?? 0),
    totalChunks: Number(formData.get("totalChunks") ?? 1),
    fileName: String(formData.get("fileName") ?? "upload.bin"),
    mimeType: String(formData.get("mimeType") ?? "application/octet-stream"),
    totalSize: Number(formData.get("totalSize") ?? 0),
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const directFile = formData.get("file");
    const chunkFile = formData.get("chunk");

    if (directFile instanceof File) {
      const arrayBuffer = await directFile.arrayBuffer();
      const { path, fileName, extension } = await saveDirectUpload(
        directFile.name,
        Buffer.from(arrayBuffer),
      );

      const saved = await db.fileAsset.create({
        data: {
          fileName,
          originalName: directFile.name,
          mimeType: directFile.type || "application/octet-stream",
          extension: extension || extname(directFile.name).toLowerCase(),
          size: BigInt(directFile.size),
          path,
          status: "uploaded",
        },
      });

      return NextResponse.json({ file: saved }, { status: 201 });
    }

    if (!(chunkFile instanceof File)) {
      return NextResponse.json(
        { error: "Provide either `file` or `chunk` field." },
        { status: 400 },
      );
    }

    const meta = parseChunkMetadata(formData);
    const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer());
    const progress = await persistChunk(meta, chunkBuffer);

    if (!progress.completed) {
      return NextResponse.json({
        uploadId: meta.uploadId,
        status: "uploading",
        receivedChunks: progress.receivedChunks,
        totalChunks: progress.totalChunks,
      });
    }

    const assembled = await assembleChunks(meta);
    const saved = await db.fileAsset.create({
      data: {
        fileName: assembled.fileName,
        originalName: meta.fileName,
        mimeType: meta.mimeType,
        extension: assembled.extension || extname(meta.fileName).toLowerCase(),
        size: BigInt(assembled.size),
        path: assembled.path,
        status: "uploaded",
      },
    });

    return NextResponse.json(
      {
        uploadId: meta.uploadId,
        status: "completed",
        file: saved,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
