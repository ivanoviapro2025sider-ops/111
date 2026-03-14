import { mkdir, stat, readdir, unlink, rmdir } from 'fs/promises';
import path from 'path';

export function getWorkspaceDir(): string {
  return path.resolve(process.cwd(), process.env.WORKSPACE_DIR || './workspace');
}

export function getProjectDir(projectId: string): string {
  return path.join(getWorkspaceDir(), projectId);
}

export function getFramesDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'frames');
}

export function getThumbnailsDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'thumbnails');
}

export function getExportDir(projectId: string): string {
  return path.join(getProjectDir(projectId), 'export');
}

export async function ensureProjectDirs(projectId: string): Promise<void> {
  const dirs = [
    getProjectDir(projectId),
    getFramesDir(projectId),
    getThumbnailsDir(projectId),
    getExportDir(projectId),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

export async function cleanDir(dirPath: string): Promise<void> {
  try {
    const files = await readdir(dirPath);
    for (const file of files) {
      await unlink(path.join(dirPath, file));
    }
  } catch {
    // Directory may not exist
  }
}

export function getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
}

export const SUPPORTED_VIDEO_FORMATS = [
  '.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv',
  '.flv', '.m4v', '.3gp', '.ts', '.mts',
];

export function isValidVideoFormat(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return SUPPORTED_VIDEO_FORMATS.includes(ext);
}
