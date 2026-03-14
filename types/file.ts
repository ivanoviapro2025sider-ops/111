export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  processedContent?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  totalSize: number;
  uploadedSize: number;
  percentage: number;
  speed: number;
  eta: number;
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'paused';
}

export interface FileProcessingOptions {
  strategy: 'full' | 'chunked' | 'summary' | 'map-reduce';
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: 'ocr' | 'transcribe' | 'extract-frames';
}

export type SupportedFileType =
  | 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx'
  | 'odt' | 'ods' | 'odp' | 'rtf'
  | 'txt' | 'log' | 'md' | 'rst'
  | 'csv' | 'json' | 'jsonl' | 'xml' | 'yaml' | 'yml' | 'html' | 'htm'
  | 'js' | 'ts' | 'jsx' | 'tsx' | 'py' | 'java' | 'c' | 'cpp' | 'h' | 'hpp'
  | 'cs' | 'go' | 'rs' | 'php' | 'rb' | 'swift' | 'kt' | 'sh' | 'bash' | 'sql'
  | 'sqlite' | 'db' | 'parquet' | 'avro'
  | 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'svg' | 'tiff'
  | 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a'
  | 'mp4' | 'webm' | 'avi' | 'mkv'
  | 'zip' | 'tar' | 'gz' | 'tgz' | 'rar' | '7z';
