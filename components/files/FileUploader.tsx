'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';

interface FileUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      try {
        await onUpload(acceptedFiles);
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        ) : isDragActive ? (
          <Upload className="h-10 w-10 text-primary" />
        ) : (
          <FileText className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">
            {uploading
              ? 'Uploading...'
              : isDragActive
              ? 'Drop files here'
              : 'Drag & Drop files here or click to browse'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports up to 10 GB per file — PDF, DOCX, XLSX, CSV, Images, Audio, Video, Code...
          </p>
        </div>
      </div>
    </div>
  );
}
