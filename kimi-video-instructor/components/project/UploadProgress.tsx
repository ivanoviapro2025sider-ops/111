'use client';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils';
import { Pause, X } from 'lucide-react';

interface UploadProgressProps {
  uploadedBytes: number;
  totalBytes: number;
  chunkIndex: number;
  totalChunks: number;
  bytesPerSecond: number;
  isPaused: boolean;
  onPause: () => void;
  onCancel: () => void;
}

export function UploadProgress({
  uploadedBytes,
  totalBytes,
  chunkIndex,
  totalChunks,
  bytesPerSecond,
  isPaused,
  onPause,
  onCancel,
}: UploadProgressProps) {
  const progressPercent = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
  const speedLabel =
    bytesPerSecond >= 1024 * 1024
      ? `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
      : bytesPerSecond >= 1024
        ? `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
        : `${bytesPerSecond} B/s`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatFileSize(uploadedBytes)} of {formatFileSize(totalBytes)}
        </span>
        <span className="text-muted-foreground">
          Chunk {chunkIndex + 1} of {totalChunks}
        </span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{Math.round(progressPercent)}%</span>
        <span className="text-sm text-muted-foreground">{speedLabel}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPause}>
          <Pause className="mr-2 h-4 w-4" />
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
