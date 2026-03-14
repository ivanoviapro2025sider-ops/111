export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
export const MAX_CONCURRENT_UPLOADS = 3;
export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY = 1000;

export interface ChunkedUploadState {
  fileId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  uploadedChunks: number;
  startTime: number;
}

export function calculateChunks(fileSize: number, chunkSize = CHUNK_SIZE): number {
  return Math.ceil(fileSize / chunkSize);
}

export async function uploadChunk(
  file: File,
  chunkIndex: number,
  uploadId: string,
  chunkSize = CHUNK_SIZE
): Promise<Response> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const chunk = file.slice(start, end);

  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', String(chunkIndex));
  formData.append('totalChunks', String(calculateChunks(file.size, chunkSize)));
  formData.append('filename', file.name);
  formData.append('totalSize', String(file.size));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) return response;
      throw new Error(`Upload failed: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('Upload failed after retries');
}
