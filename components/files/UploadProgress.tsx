'use client';

import React from 'react';
import { formatFileSize } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, Pause } from 'lucide-react';
import type { UploadProgress as UploadProgressType } from '@/types/file';

interface UploadProgressProps {
  progress: UploadProgressType;
}

export default function UploadProgress({ progress }: UploadProgressProps) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate">{progress.filename}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {progress.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin" />}
          {progress.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
          {progress.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
          {progress.status === 'paused' && <Pause className="h-3 w-3" />}
          <span>{progress.percentage}%</span>
        </div>
      </div>

      <div className="w-full bg-secondary rounded-full h-2 mb-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {formatFileSize(progress.uploadedSize)} / {formatFileSize(progress.totalSize)}
        </span>
        {progress.speed > 0 && (
          <span>
            {formatFileSize(progress.speed)}/s — ETA: {Math.ceil(progress.eta)}s
          </span>
        )}
      </div>
    </div>
  );
}
