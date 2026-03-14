import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TMP_ROOT = path.join(process.cwd(), 'uploads', '.chunks');

export interface ChunkPayload {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  mimeType: string;
  chunk: Buffer;
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function ensureUploadDirs() {
  await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });
}

export async function writeChunk(payload: ChunkPayload) {
  await ensureUploadDirs();
  const dir = path.join(TMP_ROOT, payload.uploadId);
  await fs.mkdir(dir, { recursive: true });
  const chunkPath = path.join(dir, `${payload.chunkIndex}.part`);
  await fs.writeFile(chunkPath, payload.chunk);
  return chunkPath;
}

export async function listExistingChunks(uploadId: string) {
  const dir = path.join(TMP_ROOT, uploadId);
  try {
    const files = await fs.readdir(dir);
    return files.map((file) => Number.parseInt(file, 10)).filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

export async function assembleUpload(uploadId: string, fileName: string, totalChunks: number) {
  const dir = path.join(TMP_ROOT, uploadId);
  const storedName = `${Date.now()}-${sanitizeFileName(fileName)}`;
  const targetPath = path.join(process.cwd(), 'uploads', storedName);
  const writer = createWriteStream(targetPath);

  for (let index = 0; index < totalChunks; index += 1) {
    const chunkPath = path.join(dir, `${index}.part`);
    const data = await fs.readFile(chunkPath);
    await new Promise<void>((resolve, reject) => {
      writer.write(data, (error) => (error ? reject(error) : resolve()));
    });
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error) => (error ? reject(error) : resolve()));
  });

  const stats = await fs.stat(targetPath);
  await fs.rm(dir, { recursive: true, force: true });
  return { storedName, targetPath, size: stats.size };
}
