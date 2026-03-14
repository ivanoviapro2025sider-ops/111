import fs from "node:fs/promises";
import path from "node:path";
import { getEnvNumber } from "@/lib/utils";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
export const CHUNK_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE = getEnvNumber("MAX_FILE_SIZE", 10 * 1024 * 1024 * 1024);

export interface ChunkWriteParams {
  uploadId: string;
  chunkIndex: number;
  chunk: Buffer;
}

export function getChunkDir(uploadId: string) {
  return path.join(process.cwd(), UPLOAD_DIR, ".chunks", uploadId);
}

export async function ensureUploadDirs() {
  await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR), { recursive: true });
}

export async function saveChunk(params: ChunkWriteParams) {
  const chunkDir = getChunkDir(params.uploadId);
  await fs.mkdir(chunkDir, { recursive: true });
  const chunkPath = path.join(chunkDir, `${params.chunkIndex}.part`);
  await fs.writeFile(chunkPath, params.chunk);
}

export async function hasAllChunks(uploadId: string, totalChunks: number) {
  const chunkDir = getChunkDir(uploadId);
  try {
    const files = await fs.readdir(chunkDir);
    return files.length >= totalChunks;
  } catch {
    return false;
  }
}

export async function mergeChunks(
  uploadId: string,
  totalChunks: number,
  outputRelativePath: string,
) {
  const outputPath = path.join(process.cwd(), UPLOAD_DIR, outputRelativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const chunkDir = getChunkDir(uploadId);
  const handle = await fs.open(outputPath, "w");

  try {
    for (let i = 0; i < totalChunks; i += 1) {
      const chunkPath = path.join(chunkDir, `${i}.part`);
      const chunkBuffer = await fs.readFile(chunkPath);
      await handle.write(chunkBuffer);
    }
  } finally {
    await handle.close();
  }

  await fs.rm(chunkDir, { recursive: true, force: true });
  return outputPath;
}
