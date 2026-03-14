import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export interface ChunkInfo {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  totalSize: number;
}

function getChunkDir(fileId: string): string {
  return path.join(UPLOAD_DIR, 'chunks', fileId);
}

export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function saveChunk(
  fileId: string,
  chunkIndex: number,
  data: Buffer
): Promise<void> {
  const chunkDir = getChunkDir(fileId);
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, data);
}

export async function assembleChunks(
  fileId: string,
  totalChunks: number,
  fileName: string
): Promise<string> {
  ensureUploadDir();
  const chunkDir = getChunkDir(fileId);
  const ext = path.extname(fileName);
  const outputPath = path.join(UPLOAD_DIR, `${fileId}${ext}`);
  const writeStream = fs.createWriteStream(outputPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`Missing chunk ${i} for file ${fileId}`);
    }
    const chunkData = fs.readFileSync(chunkPath);
    writeStream.write(chunkData);
  }

  return new Promise((resolve, reject) => {
    writeStream.end(() => {
      fs.rmSync(chunkDir, { recursive: true, force: true });
      resolve(outputPath);
    });
    writeStream.on('error', reject);
  });
}

export function getUploadProgress(fileId: string, totalChunks: number): number {
  const chunkDir = getChunkDir(fileId);
  if (!fs.existsSync(chunkDir)) return 0;
  const files = fs.readdirSync(chunkDir);
  return (files.length / totalChunks) * 100;
}
