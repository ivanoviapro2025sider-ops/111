export interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
  processedText?: string;
  metadata: Record<string, unknown>;
  chatId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadConfig {
  chunkSize: number;
  maxFileSize: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
  retryDelay: number;
}

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  chunkSize: 5 * 1024 * 1024,
  maxFileSize: 10 * 1024 * 1024 * 1024,
  maxConcurrentUploads: 3,
  retryAttempts: 3,
  retryDelay: 1000,
};

export interface FileProcessingOptions {
  strategy: 'full' | 'chunked' | 'summary' | 'map-reduce';
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: 'ocr' | 'transcribe' | 'extract-frames';
}

export const SUPPORTED_EXTENSIONS: Record<string, string[]> = {
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.log', '.md', '.rst', '.csv', '.json', '.jsonl', '.xml', '.yml', '.yaml', '.html', '.htm'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.sh', '.bash', '.sql'],
  data: ['.sqlite', '.db', '.parquet', '.avro'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],
  video: ['.mp4', '.webm', '.avi', '.mkv'],
  archives: ['.zip', '.tar', '.tar.gz', '.tgz', '.rar', '.7z'],
};

export function getAllSupportedExtensions(): string[] {
  return Object.values(SUPPORTED_EXTENSIONS).flat();
}
