'use client';

import { useCallback, useState, useRef } from 'react';
import { formatFileSize } from '@/lib/utils';
import { UploadProgress } from './UploadProgress';
import { Upload, FileVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHUNK_SIZE = 5 * 1024 * 1024;

interface UploadState {
  uploadId: string;
  file: File;
  chunkIndex: number;
  totalChunks: number;
  uploadedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  lastUpdateTime: number;
  lastUploadedBytes: number;
  isPaused: boolean;
  isCancelled: boolean;
}

export function VideoUploader({
  onComplete,
  onError,
  className,
}: {
  onComplete?: (uploadId: string, fileName: string) => void;
  onError?: (error: Error) => void;
  className?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateSpeed = useCallback(
    (uploadedBytes: number) => {
      setUploadState((prev) => {
        if (!prev) return prev;
        const now = Date.now();
        const elapsed = (now - prev.lastUpdateTime) / 1000;
        const bytesPerSecond =
          elapsed > 0 ? (uploadedBytes - prev.lastUploadedBytes) / elapsed : 0;
        return {
          ...prev,
          uploadedBytes,
          bytesPerSecond: bytesPerSecond > 0 ? bytesPerSecond : prev.bytesPerSecond,
          lastUpdateTime: now,
          lastUploadedBytes: uploadedBytes,
        };
      });
    },
    []
  );

  const uploadChunks = useCallback(
    async (state: UploadState): Promise<void> => {
      if (state.isCancelled) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      for (let i = state.chunkIndex; i < state.totalChunks; i++) {
        if (state.isCancelled || controller.signal.aborted) break;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, state.file.size);
        const chunk = state.file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', state.uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('chunk', chunk);

        try {
          await fetch('/api/upload/chunk', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          const uploadedBytes = Math.min((i + 1) * CHUNK_SIZE, state.totalBytes);
          updateSpeed(uploadedBytes);

          setUploadState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              chunkIndex: i + 1,
              uploadedBytes,
            };
          });

          if (i === state.totalChunks - 1) {
            const res = await fetch('/api/upload/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uploadId: state.uploadId,
                fileName: state.file.name,
                fileSize: state.file.size,
              }),
            });
            if (!res.ok) throw new Error('Failed to complete upload');
            setUploadState(null);
            setFile(null);
            onComplete?.(state.uploadId, state.file.name);
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          setError((err as Error).message);
          onError?.(err as Error);
          setUploadState(null);
          return;
        }
      }
    },
    [updateSpeed, onComplete, onError]
  );

  const handleInitAndUpload = useCallback(
    async (selectedFile: File) => {
      setError(null);
      setFile(selectedFile);

      const res = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
        }),
      });

      if (!res.ok) {
        const err = new Error('Failed to initialize upload');
        setError(err.message);
        onError?.(err);
        return;
      }

      const { uploadId } = await res.json();
      const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
      const now = Date.now();

      const state: UploadState = {
        uploadId,
        file: selectedFile,
        chunkIndex: 0,
        totalChunks,
        uploadedBytes: 0,
        totalBytes: selectedFile.size,
        bytesPerSecond: 0,
        lastUpdateTime: now,
        lastUploadedBytes: 0,
        isPaused: false,
        isCancelled: false,
      };

      setUploadState(state);
      uploadChunks(state);
    },
    [uploadChunks, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type.startsWith('video/')) {
        handleInitAndUpload(droppedFile);
      } else {
        setError('Please select a video file');
      }
    },
    [handleInitAndUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile?.type.startsWith('video/')) {
        handleInitAndUpload(selectedFile);
      } else if (selectedFile) {
        setError('Please select a video file');
      }
      e.target.value = '';
    },
    [handleInitAndUpload]
  );

  const handlePause = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState((prev) => (prev ? { ...prev, isPaused: true } : null));
  }, []);

  const handleResume = useCallback(() => {
    setUploadState((prev) => {
      if (!prev || !prev.isPaused) return prev;
      const resumed = { ...prev, isPaused: false };
      uploadChunks(resumed);
      return resumed;
    });
  }, [uploadChunks]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState((prev) => (prev ? { ...prev, isCancelled: true } : null));
    setUploadState(null);
    setFile(null);
    setError(null);
  }, []);

  if (uploadState) {
    return (
      <div className={cn('space-y-4 rounded-lg border p-4', className)}>
        <div className="flex items-center gap-2 text-sm">
          <FileVideo className="h-4 w-4" />
          <span className="font-medium">{uploadState.file.name}</span>
          <span className="text-muted-foreground">
            ({formatFileSize(uploadState.file.size)})
          </span>
        </div>
        <UploadProgress
          uploadedBytes={uploadState.uploadedBytes}
          totalBytes={uploadState.totalBytes}
          chunkIndex={uploadState.chunkIndex}
          totalChunks={uploadState.totalChunks}
          bytesPerSecond={uploadState.bytesPerSecond}
          isPaused={uploadState.isPaused}
          onPause={uploadState.isPaused ? handleResume : handlePause}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        className
      )}
    >
      <input
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        id="video-upload"
      />
      <label
        htmlFor="video-upload"
        className="flex cursor-pointer flex-col items-center gap-4"
      >
        <Upload className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Drag and drop a video file, or click to select
          </p>
          <p className="text-xs text-muted-foreground">
            Supports common video formats
          </p>
        </div>
      </label>
      {file && !uploadState && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <FileVideo className="h-4 w-4" />
          <span>{file.name}</span>
          <span>({formatFileSize(file.size)})</span>
        </div>
      )}
      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
