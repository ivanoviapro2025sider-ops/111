export type FileProcessingStrategy = "full" | "chunked" | "summary" | "map-reduce";
export type FilePreprocessor = "ocr" | "transcribe" | "extract-frames";

export interface UploadConfig {
  chunkSize: number;
  maxFileSize: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface FileProcessingOptions {
  strategy: FileProcessingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: FilePreprocessor;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: string;
  path: string;
  status: "pending" | "uploading" | "uploaded" | "processed" | "failed";
  processingOutput?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
