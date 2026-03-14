'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import { ALL_SUPPORTED_EXTENSIONS } from '@/types/file';

interface FileUploaderProps {
  onUploadComplete: (fileData: unknown) => void;
  maxSize?: number;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export function FileUploader({ onUploadComplete, maxSize = 10737418240 }: FileUploaderProps) {
  const [uploads, setUploads] = useState<
    Array<{ file: File; progress: number; status: string; id?: string }>
  >([]);

  const uploadFile = async (file: File) => {
    const fileId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setUploads((prev) => [...prev, { file, progress: 0, status: 'uploading', id: fileId }]);

    try {
      if (file.size <= CHUNK_SIZE) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileId', fileId);
        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        const data = await res.json();
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, progress: 100, status: 'completed' } : u))
        );
        onUploadComplete(data.file);
        return;
      }

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('file', new File([chunk], file.name));
        formData.append('fileId', fileId);
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));
        formData.append('fileName', file.name);
        formData.append('mimeType', file.type);
        formData.append('totalSize', String(file.size));

        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        const data = await res.json();

        const progress = ((i + 1) / totalChunks) * 100;
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, progress } : u))
        );

        if (data.complete) {
          setUploads((prev) =>
            prev.map((u) => (u.id === fileId ? { ...u, progress: 100, status: 'completed' } : u))
          );
          onUploadComplete(data.file);
        }
      }
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) => (u.id === fileId ? { ...u, status: 'error' } : u))
      );
      console.error('Upload error:', error);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        uploadFile(file);
      }
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
  });

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          {isDragActive ? 'Drop files here...' : 'Drag & Drop files here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports up to {formatFileSize(maxSize)} per file
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, XLSX, CSV, Images, Audio, Video, Code...
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{upload.file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(upload.file.size)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      upload.status === 'error' ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground capitalize">{upload.status}</span>
                  <span className="text-[10px] text-muted-foreground">{Math.round(upload.progress)}%</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeUpload(upload.id!)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
