import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MAX_FILE_SIZE =
  Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024;
export const DEFAULT_UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
export const DEFAULT_MODEL =
  process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2";

export function formatBytes(bytes: number | bigint) {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const normalized = value / 1024 ** i;
  return `${normalized.toFixed(normalized > 10 ? 1 : 2)} ${units[i]}`;
}
