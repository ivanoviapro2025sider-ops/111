export interface UploadedFileRecord {
  id: string;
  fileName: string;
  storedName: string;
  path: string;
  mimeType: string;
  size: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  extractedText?: string | null;
  summary?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FileProcessingOptions {
  strategy: 'full' | 'chunked' | 'summary' | 'map-reduce';
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: 'ocr' | 'transcribe' | 'extract-frames';
}
