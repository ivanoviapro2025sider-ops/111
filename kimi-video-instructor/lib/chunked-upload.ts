import { mkdir, writeFile, readFile, readdir, unlink, rmdir, rename } from 'fs/promises';
import path from 'path';
import { getWorkspaceDir, getProjectDir } from './file-utils';

export interface UploadSession {
  uploadId: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: number[];
  createdAt: number;
}

const sessions = new Map<string, UploadSession>();

export function getTmpDir(): string {
  return path.join(getWorkspaceDir(), 'tmp');
}

export function getChunkDir(uploadId: string): string {
  return path.join(getTmpDir(), uploadId);
}

export async function initUpload(
  uploadId: string,
  projectId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  totalChunks: number,
): Promise<UploadSession> {
  const chunkDir = getChunkDir(uploadId);
  await mkdir(chunkDir, { recursive: true });

  const session: UploadSession = {
    uploadId,
    projectId,
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    receivedChunks: [],
    createdAt: Date.now(),
  };

  sessions.set(uploadId, session);
  return session;
}

export async function saveChunk(
  uploadId: string,
  chunkIndex: number,
  data: Buffer,
): Promise<{ received: number; total: number }> {
  const chunkDir = getChunkDir(uploadId);
  await mkdir(chunkDir, { recursive: true });

  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(5, '0')}`);
  await writeFile(chunkPath, data);

  const session = sessions.get(uploadId);
  if (session && !session.receivedChunks.includes(chunkIndex)) {
    session.receivedChunks.push(chunkIndex);
  }

  return {
    received: session?.receivedChunks.length || chunkIndex + 1,
    total: session?.totalChunks || 0,
  };
}

export async function completeUpload(
  uploadId: string,
  projectId: string,
): Promise<string> {
  const chunkDir = getChunkDir(uploadId);
  const projectDir = getProjectDir(projectId);
  await mkdir(projectDir, { recursive: true });

  const session = sessions.get(uploadId);
  const fileName = session?.fileName || 'source.mp4';
  const outputPath = path.join(projectDir, 'source' + path.extname(fileName));

  const files = (await readdir(chunkDir))
    .filter((f) => f.startsWith('chunk_'))
    .sort();

  const chunks: Buffer[] = [];
  for (const file of files) {
    const chunk = await readFile(path.join(chunkDir, file));
    chunks.push(chunk);
  }

  await writeFile(outputPath, Buffer.concat(chunks));

  // Cleanup chunks
  for (const file of files) {
    await unlink(path.join(chunkDir, file));
  }
  try {
    await rmdir(chunkDir);
  } catch {}

  sessions.delete(uploadId);
  return outputPath;
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
  return sessions.get(uploadId);
}
