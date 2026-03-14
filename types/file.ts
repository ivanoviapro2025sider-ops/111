export type FileStatus = 'uploading' | 'pending' | 'processing' | 'processed' | 'error';

export interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  status: FileStatus;
  processedContent?: string;
  metadata: Record<string, unknown>;
  chatId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  speed: number;
  eta: number;
  status: 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface ChunkUploadRequest {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  mimeType: string;
  totalSize: number;
}

export interface FileProcessingOptions {
  strategy: 'full' | 'chunked' | 'summary' | 'map-reduce';
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: 'ocr' | 'transcribe' | 'extract-frames';
}

export const SUPPORTED_FILE_TYPES: Record<string, string[]> = {
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.log', '.md', '.rst', '.csv', '.json', '.jsonl', '.xml', '.yml', '.yaml', '.html', '.htm'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.sh', '.bash', '.sql'],
  data: ['.sqlite', '.db', '.parquet', '.avro'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],
  video: ['.mp4', '.webm', '.avi', '.mkv'],
  archives: ['.zip', '.tar', '.tar.gz', '.tgz', '.rar', '.7z'],
};

export const ALL_SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILE_TYPES).flat();
