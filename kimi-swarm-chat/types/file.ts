export type FileStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "failed"
  | "uploading";

export type ProcessingStrategy = "full" | "chunked" | "summary" | "map-reduce";
export type Preprocessor = "ocr" | "transcribe" | "extract-frames";

export interface FileAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface FileRecord {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  path: string;
  status: FileStatus;
  extractedText?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  uploadedAt: string;
  updatedAt: string;
}

export interface UploadConfig {
  chunkSize: number;
  maxFileSize: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface FileProcessingOptions {
  strategy: ProcessingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: Preprocessor;
}
