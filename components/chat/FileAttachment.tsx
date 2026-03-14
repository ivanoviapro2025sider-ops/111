'use client';

import React from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import { FileText, Image, Film, Music, Archive, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileAttachmentProps {
  filename: string;
  size: number;
  mimeType?: string;
  onRemove?: () => void;
  status?: string;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar'))
    return Archive;
  return FileText;
}

export default function FileAttachment({ filename, size, mimeType, onRemove, status }: FileAttachmentProps) {
  const Icon = getFileIcon(mimeType);

  return (
    <div className="inline-flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="font-medium truncate max-w-[200px]">{filename}</div>
        <div className="text-muted-foreground">
          {formatFileSize(size)}
          {status && (
            <span
              className={cn(
                'ml-1',
                status === 'processed' && 'text-green-500',
                status === 'error' && 'text-red-500',
                status === 'processing' && 'text-yellow-500'
              )}
            >
              {status}
            </span>
          )}
        </div>
      </div>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
