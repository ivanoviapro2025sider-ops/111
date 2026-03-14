import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
const chunkRoot = path.join(uploadDir, ".chunks");

export interface UploadChunkInput {
  uploadId: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: Buffer;
}

export interface CompleteUploadInput {
  uploadId: string;
  fileName: string;
  totalChunks: number;
}

export async function ensureUploadDirs() {
  await mkdir(uploadDir, { recursive: true });
  await mkdir(chunkRoot, { recursive: true });
}

export async function storeChunk(input: UploadChunkInput) {
  await ensureUploadDirs();
  const uploadChunkDir = path.join(chunkRoot, input.uploadId);
  await mkdir(uploadChunkDir, { recursive: true });
  const chunkPath = path.join(uploadChunkDir, `${input.chunkIndex}.part`);
  await writeFile(chunkPath, input.chunk);
  return chunkPath;
}

export async function getChunkProgress(uploadId: string, totalChunks: number) {
  const uploadChunkDir = path.join(chunkRoot, uploadId);
  await mkdir(uploadChunkDir, { recursive: true });
  const files = await readdir(uploadChunkDir);
  const uploaded = files.filter((f) => f.endsWith(".part")).length;
  return {
    uploaded,
    totalChunks,
    isComplete: uploaded >= totalChunks,
  };
}

export async function completeUpload(input: CompleteUploadInput) {
  await ensureUploadDirs();
  const uploadChunkDir = path.join(chunkRoot, input.uploadId);
  const destinationPath = path.join(uploadDir, `${input.uploadId}-${input.fileName}`);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  const writer = createWriteStream(destinationPath, { flags: "w" });

  for (let index = 0; index < input.totalChunks; index += 1) {
    const chunkPath = path.join(uploadChunkDir, `${index}.part`);
    await stat(chunkPath);
    const chunk = await readFile(chunkPath);
    writer.write(chunk);
  }

  writer.end();
  await new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", reject);
  });
  await rm(uploadChunkDir, { recursive: true, force: true });
  return destinationPath;
}
