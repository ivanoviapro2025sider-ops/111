import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { randomUUID } from "node:crypto";

import { ensureDataDirectories, readJsonOrDefault, uploadsFilesRoot, uploadsIndexFile, uploadsTempRoot, writeJsonFile } from "@/lib/storage";
import { uploadRecordSchema, type UploadMode, type UploadRecord } from "@/lib/types";

export const uploadChunkSize = 8 * 1024 * 1024;

const uploadIndexSchema = uploadRecordSchema.array();

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function detectUploadMode(fileName: string, mimeType: string): UploadMode {
  const extension = path.extname(fileName).toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (
    mimeType.startsWith("text/") ||
    [
      ".md",
      ".json",
      ".csv",
      ".xml",
      ".yaml",
      ".yml",
      ".log",
      ".ini",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".java",
      ".go",
      ".rs",
      ".sql",
      ".html",
      ".css"
    ].includes(extension)
  ) {
    return "text";
  }
  if (
    [
      ".pdf",
      ".docx",
      ".xlsx",
      ".xlsm",
      ".pptx",
      ".rtf",
      ".odt"
    ].includes(extension)
  ) {
    return "document";
  }
  return "binary";
}

async function readUploadIndex() {
  await ensureDataDirectories();
  const raw = await readJsonOrDefault(uploadsIndexFile, []);
  return uploadIndexSchema.parse(raw);
}

async function writeUploadIndex(records: UploadRecord[]) {
  await writeJsonFile(uploadsIndexFile, records);
}

async function updateUploadRecord(uploadId: string, updater: (record: UploadRecord) => UploadRecord) {
  const records = await readUploadIndex();
  const index = records.findIndex((record) => record.id === uploadId);
  if (index === -1) {
    throw new Error(`Upload ${uploadId} not found.`);
  }
  records[index] = updater(records[index]);
  await writeUploadIndex(records);
  return records[index];
}

export async function listUploads() {
  const records = await readUploadIndex();
  return records.sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());
}

export async function getUploadsByIds(uploadIds: string[]) {
  const records = await readUploadIndex();
  const requested = new Set(uploadIds);
  return records.filter((record) => requested.has(record.id) && record.status === "ready");
}

export async function startUpload(input: { originalName: string; size: number; mimeType: string }) {
  await ensureDataDirectories();
  const uploadId = randomUUID();
  const safeName = sanitizeFileName(input.originalName);
  const expectedParts = Math.max(1, Math.ceil(input.size / uploadChunkSize));
  const record: UploadRecord = {
    id: uploadId,
    originalName: input.originalName,
    safeName,
    mimeType: input.mimeType,
    size: input.size,
    path: path.join(uploadsFilesRoot, `${uploadId}-${safeName}`),
    status: "uploading",
    uploadedAt: new Date().toISOString(),
    expectedParts,
    mode: detectUploadMode(input.originalName, input.mimeType),
    receivedParts: []
  };
  const records = await readUploadIndex();
  records.unshift(record);
  await writeUploadIndex(records);
  await mkdir(path.join(uploadsTempRoot, uploadId), { recursive: true });
  return { uploadId, chunkSize: uploadChunkSize, record };
}

export async function writeUploadChunk(uploadId: string, partNumber: number, body: ReadableStream<Uint8Array> | null) {
  if (body === null) {
    throw new Error("Chunk body is empty.");
  }

  const records = await readUploadIndex();
  const record = records.find((candidate) => candidate.id === uploadId);

  if (!record) {
    throw new Error(`Upload ${uploadId} not found.`);
  }

  if (partNumber < 0 || partNumber >= record.expectedParts) {
    throw new Error(`Part ${partNumber} is outside the expected range.`);
  }

  const tempDirectory = path.join(uploadsTempRoot, uploadId);
  await mkdir(tempDirectory, { recursive: true });
  const partPath = path.join(tempDirectory, `${partNumber}.part`);
  const nodeReadable = Readable.fromWeb(body as globalThis.ReadableStream<Uint8Array>);

  await new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(partPath);
    writer.on("finish", resolve);
    writer.on("error", reject);
    nodeReadable.on("error", reject);
    nodeReadable.pipe(writer);
  });

  const nextReceivedParts = Array.from(new Set([...record.receivedParts, partNumber])).sort((left, right) => left - right);
  await updateUploadRecord(uploadId, (current) => ({
    ...current,
    receivedParts: nextReceivedParts
  }));

  return {
    receivedParts: nextReceivedParts.length,
    expectedParts: record.expectedParts
  };
}

async function pipePartIntoWriter(partPath: string, writer: ReturnType<typeof createWriteStream>) {
  await new Promise<void>((resolve, reject) => {
    const reader = createReadStream(partPath);
    reader.on("error", reject);
    writer.on("error", reject);
    reader.on("end", resolve);
    reader.pipe(writer, { end: false });
  });
}

export async function completeUpload(uploadId: string) {
  const records = await readUploadIndex();
  const record = records.find((candidate) => candidate.id === uploadId);

  if (!record) {
    throw new Error(`Upload ${uploadId} not found.`);
  }

  const tempDirectory = path.join(uploadsTempRoot, uploadId);
  const tempParts = await readdir(tempDirectory);
  const partNumbers = tempParts
    .map((fileName) => Number.parseInt(path.basename(fileName, ".part"), 10))
    .filter((partNumber) => Number.isInteger(partNumber))
    .sort((left, right) => left - right);

  if (partNumbers.length !== record.expectedParts) {
    throw new Error(`Upload ${uploadId} is incomplete. Expected ${record.expectedParts} parts, got ${partNumbers.length}.`);
  }

  if (await fileExists(record.path)) {
    await unlink(record.path);
  }

  const writer = createWriteStream(record.path);

  for (const partNumber of partNumbers) {
    await pipePartIntoWriter(path.join(tempDirectory, `${partNumber}.part`), writer);
  }

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
    writer.end();
  });

  await rm(tempDirectory, { recursive: true, force: true });

  const updated = await updateUploadRecord(uploadId, (current) => ({
    ...current,
    status: "ready",
    receivedParts: Array.from({ length: current.expectedParts }, (_, index) => index)
  }));

  return updated;
}
