import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { defaultSettings } from "@/lib/defaults";
import { settingsSchema } from "@/lib/types";

export const dataRoot = path.join(process.cwd(), "data");
export const uploadsRoot = path.join(dataRoot, "uploads");
export const uploadsFilesRoot = path.join(uploadsRoot, "files");
export const uploadsTempRoot = path.join(uploadsRoot, "tmp");
export const settingsFile = path.join(dataRoot, "settings.json");
export const uploadsIndexFile = path.join(uploadsRoot, "index.json");

async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

export async function ensureDataDirectories() {
  await Promise.all([
    ensureDirectory(dataRoot),
    ensureDirectory(uploadsRoot),
    ensureDirectory(uploadsFilesRoot),
    ensureDirectory(uploadsTempRoot)
  ]);
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  await ensureDirectory(path.dirname(filePath));
  const tempFilePath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempFilePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempFilePath, filePath);
}

export async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      await writeJsonAtomic(filePath, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function getSettings() {
  await ensureDataDirectories();
  const raw = await readJsonOrDefault(settingsFile, defaultSettings);
  return settingsSchema.parse(raw);
}

export async function saveSettings(nextSettings: unknown) {
  await ensureDataDirectories();
  const parsed = settingsSchema.parse(nextSettings);
  await writeJsonAtomic(settingsFile, parsed);
  return parsed;
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await writeJsonAtomic(filePath, data);
}
