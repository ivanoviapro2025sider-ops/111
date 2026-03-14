import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE =
  Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024;
export const MAX_CONCURRENT_UPLOADS = 3;
export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

export interface UploadConfig {
  chunkSize: number;
  maxFileSize: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
  retryDelay: number;
}

export const uploadConfig: UploadConfig = {
  chunkSize: UPLOAD_CHUNK_SIZE,
  maxFileSize: MAX_FILE_SIZE,
  maxConcurrentUploads: MAX_CONCURRENT_UPLOADS,
  retryAttempts: RETRY_ATTEMPTS,
  retryDelay: RETRY_DELAY_MS,
};

const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
const chunksRootDir = path.join(uploadsDir, ".chunks");

export async function ensureUploadDirectories() {
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(chunksRootDir, { recursive: true });
}

export function getUploadPath(fileName: string) {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^\w.-]+/g, "_");
  return path.join(uploadsDir, `${timestamp}_${sanitized}`);
}

export async function saveChunk(
  uploadId: string,
  chunkIndex: number,
  payload: Buffer,
) {
  await ensureUploadDirectories();

  const uploadChunkDir = path.join(chunksRootDir, uploadId);
  await mkdir(uploadChunkDir, { recursive: true });

  const chunkPath = path.join(uploadChunkDir, `${chunkIndex}.part`);
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(chunkPath);
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    stream.end(payload);
  });

  return chunkPath;
}

export async function hasChunk(uploadId: string, chunkIndex: number) {
  const filePath = path.join(chunksRootDir, uploadId, `${chunkIndex}.part`);
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function assembleChunks(
  uploadId: string,
  totalChunks: number,
  targetPath: string,
) {
  const uploadChunkDir = path.join(chunksRootDir, uploadId);
  await mkdir(path.dirname(targetPath), { recursive: true });

  await new Promise<void>(async (resolve, reject) => {
    const output = createWriteStream(targetPath);
    output.on("error", reject);

    for (let i = 0; i < totalChunks; i += 1) {
      const chunkPath = path.join(uploadChunkDir, `${i}.part`);
      try {
        const chunk = await import("node:fs/promises").then((m) => m.readFile(chunkPath));
        output.write(chunk);
      } catch (error) {
        output.destroy();
        reject(error);
        return;
      }
    }

    output.end(() => resolve());
  });

  await rm(uploadChunkDir, { recursive: true, force: true });
}

export async function listIncompleteUploads() {
  await ensureUploadDirectories();
  return readdir(chunksRootDir);
}
