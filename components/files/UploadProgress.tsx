'use client';

import { UploadProgress as UploadProgressType } from '@/types/file';
import { formatFileSize, formatDuration } from '@/lib/utils';

interface UploadProgressProps {
  progress: UploadProgressType;
}

export function UploadProgress({ progress }: UploadProgressProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{progress.fileName}</span>
          <span className="text-xs text-muted-foreground">{Math.round(progress.progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            {formatFileSize(progress.speed)}/s
          </span>
          <span className="text-[10px] text-muted-foreground">
            ETA: {formatDuration(progress.eta)}
          </span>
        </div>
      </div>
    </div>
  );
}
