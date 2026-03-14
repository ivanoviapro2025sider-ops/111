export type FileStatus = "uploading" | "uploaded" | "processed" | "failed";

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  url?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileProcessingOptions {
  strategy: "full" | "chunked" | "summary" | "map-reduce";
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: "ocr" | "transcribe" | "extract-frames";
}

export const defaultFileProcessingOptions: FileProcessingOptions = {
  strategy: "chunked",
  chunkSize: 8000,
  chunkOverlap: 300,
  maxContextTokens: 16000,
};
