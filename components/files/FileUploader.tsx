'use client';

import React, { useCallback, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import { ChunkedUploader, type UploadProgress } from '@/lib/chunked-upload';
import { Progress } from '@/components/ui/progress';

interface FileUploaderProps {
  onUploadComplete: (file: { id: string; name: string }) => void;
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const handleFiles = useCallback(async (files: FileList) => {
    const uploader = new ChunkedUploader();

    for (const file of Array.from(files)) {
      try {
        const result = await uploader.upload(
          file,
          (progress) => {
            setUploads((prev) => {
              const idx = prev.findIndex(u => u.fileId === progress.fileId);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = progress;
                return updated;
              }
              return [...prev, progress];
            });
          }
        );

        onUploadComplete(result);

        await fetch('/api/files/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: result.id }),
        });
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  }, [onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        )}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Drag & Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports up to 10 GB per file — PDF, DOCX, XLSX, CSV, Images, Audio, Video, Code...
            </p>
          </div>
        </div>
      </div>

      {uploads.filter(u => u.status === 'uploading').map((upload) => (
        <div key={upload.fileId} className="bg-card border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="truncate max-w-[200px]">{upload.fileName}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {upload.percentage}% — {formatBytes(upload.speed)}/s — ETA: {Math.ceil(upload.eta)}s
            </span>
          </div>
          <Progress value={upload.percentage} />
        </div>
      ))}
    </div>
  );
}
