import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { DEFAULT_UPLOAD_DIR, MAX_FILE_SIZE } from "@/lib/utils";

const CHUNKS_DIR = ".chunks";

export interface ChunkMetadata {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  mimeType: string;
  totalSize: number;
}

function sanitizeName(fileName: string) {
  return basename(fileName).replace(/[^\w.\-]/g, "_");
}

export function resolveUploadDir() {
  return resolve(process.cwd(), DEFAULT_UPLOAD_DIR);
}

export async function ensureUploadFolders() {
  const uploadDir = resolveUploadDir();
  await mkdir(uploadDir, { recursive: true });
  await mkdir(join(uploadDir, CHUNKS_DIR), { recursive: true });
  return uploadDir;
}

export async function saveDirectUpload(fileName: string, bytes: Buffer) {
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new Error("File exceeds max file size (10 GB).");
  }

  const uploadDir = await ensureUploadFolders();
  const safeName = `${Date.now()}-${randomUUID()}-${sanitizeName(fileName)}`;
  const path = join(uploadDir, safeName);
  await writeFile(path, bytes);

  return { path, fileName: safeName, extension: extname(safeName).toLowerCase() };
}

export async function persistChunk(meta: ChunkMetadata, bytes: Buffer) {
  if (meta.totalSize > MAX_FILE_SIZE) {
    throw new Error("File exceeds max file size (10 GB).");
  }

  const uploadDir = await ensureUploadFolders();
  const chunkDir = join(uploadDir, CHUNKS_DIR, meta.uploadId);
  await mkdir(chunkDir, { recursive: true });
  const chunkPath = join(chunkDir, `${meta.chunkIndex}.part`);
  await writeFile(chunkPath, bytes);

  const existing = await readdir(chunkDir);
  const receivedChunks = existing.filter((name) => name.endsWith(".part")).length;

  return {
    completed: receivedChunks >= meta.totalChunks,
    receivedChunks,
    totalChunks: meta.totalChunks,
    chunkDir,
  };
}

export async function assembleChunks(meta: ChunkMetadata) {
  const uploadDir = await ensureUploadFolders();
  const chunkDir = join(uploadDir, CHUNKS_DIR, meta.uploadId);
  const safeName = `${Date.now()}-${meta.uploadId}-${sanitizeName(meta.fileName)}`;
  const finalPath = join(uploadDir, safeName);

  const writer = createWriteStream(finalPath, { flags: "w" });
  for (let i = 0; i < meta.totalChunks; i += 1) {
    const chunkPath = join(chunkDir, `${i}.part`);
    await pipeline(createReadStream(chunkPath), writer, { end: false });
  }
  writer.end();

  await new Promise<void>((resolveDone, rejectDone) => {
    writer.once("finish", () => resolveDone());
    writer.once("error", rejectDone);
  });

  const fileInfo = await stat(finalPath);
  if (fileInfo.size > MAX_FILE_SIZE) {
    await rm(finalPath, { force: true });
    throw new Error("Assembled file exceeds max file size (10 GB).");
  }

  await rm(chunkDir, { recursive: true, force: true });

  return {
    path: finalPath,
    fileName: safeName,
    extension: extname(safeName).toLowerCase(),
    size: fileInfo.size,
  };
}
