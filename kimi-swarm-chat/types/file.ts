export type FileStatus = "UPLOADING" | "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";

export interface FileRecord {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  path: string;
  status: FileStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadChunkPayload {
  uploadId: string;
  fileName: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  totalSize: number;
}
