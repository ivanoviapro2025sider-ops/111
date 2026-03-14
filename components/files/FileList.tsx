'use client';

import React from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Film, Music, Archive, File, Trash2, Eye, RotateCcw } from 'lucide-react';
import type { UploadedFile } from '@/types/file';

interface FileListProps {
  files: UploadedFile[];
  onDelete: (id: string) => void;
  onReprocess: (id: string) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar'))
    return Archive;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text'))
    return FileText;
  return File;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'processed':
      return 'text-green-500';
    case 'processing':
      return 'text-yellow-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

export default function FileList({ files, onDelete, onReprocess }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    );
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <span>
          {files.length} file{files.length !== 1 ? 's' : ''}, {formatFileSize(totalSize)} total
        </span>
      </div>

      {files.map((file) => {
        const Icon = getFileIcon(file.mimeType);
        return (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
          >
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{file.originalName}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(file.size)}</span>
                <span className={cn(getStatusColor(file.status))}>
                  {file.status === 'processed' && 'Processed'}
                  {file.status === 'processing' && 'Processing...'}
                  {file.status === 'error' && 'Error'}
                  {file.status === 'pending' && 'Pending'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {file.status === 'error' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onReprocess(file.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(file.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
