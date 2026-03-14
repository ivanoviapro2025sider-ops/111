import { DEFAULT_UPLOAD_CONFIG, type UploadConfig } from '@/types/file';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  eta: number;
  status: 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export class ChunkedUploader {
  private config: UploadConfig;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<UploadConfig>) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
  }

  async upload(
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    chatId?: string
  ): Promise<{ id: string; name: string }> {
    this.abortController = new AbortController();
    const totalChunks = Math.ceil(file.size / this.config.chunkSize);
    const startTime = Date.now();
    let bytesUploaded = 0;

    const initResponse = await fetch('/api/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        chatId,
      }),
    });

    if (!initResponse.ok) {
      throw new Error('Failed to initialize upload');
    }

    const { uploadId } = await initResponse.json();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      const start = chunkIndex * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);
      const chunk = file.slice(start, end);

      let attempts = 0;
      while (attempts < this.config.retryAttempts) {
        try {
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', String(chunkIndex));
          formData.append('totalChunks', String(totalChunks));

          const response = await fetch('/api/files/upload', {
            method: 'PUT',
            body: formData,
            signal: this.abortController.signal,
          });

          if (!response.ok) throw new Error(`Chunk upload failed: ${response.status}`);
          break;
        } catch (err) {
          attempts++;
          if (attempts >= this.config.retryAttempts) throw err;
          await new Promise(r => setTimeout(r, this.config.retryDelay * attempts));
        }
      }

      bytesUploaded = end;
      const elapsed = Date.now() - startTime;
      const speed = bytesUploaded / (elapsed / 1000);
      const remaining = file.size - bytesUploaded;
      const eta = speed > 0 ? remaining / speed : 0;

      onProgress?.({
        fileId: uploadId,
        fileName: file.name,
        bytesUploaded,
        totalBytes: file.size,
        percentage: Math.round((bytesUploaded / file.size) * 100),
        speed,
        eta,
        status: 'uploading',
      });
    }

    onProgress?.({
      fileId: uploadId,
      fileName: file.name,
      bytesUploaded: file.size,
      totalBytes: file.size,
      percentage: 100,
      speed: 0,
      eta: 0,
      status: 'completed',
    });

    return { id: uploadId, name: file.name };
  }

  abort() {
    this.abortController?.abort();
  }
}
