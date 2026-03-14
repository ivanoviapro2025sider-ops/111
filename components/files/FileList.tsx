'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { UploadedFile } from '@/types/file';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FileListProps {
  files: UploadedFile[];
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) return FileArchive;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('python')) return FileCode;
  return FileText;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'processed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'pending':
    case 'uploaded':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

export default function FileList({ files, onDelete, onPreview }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No files uploaded yet
      </div>
    );
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{files.length} file(s)</span>
        <span>Total: {formatBytes(totalSize)}</span>
      </div>

      <AnimatePresence>
        {files.map((file) => {
          const Icon = getFileIcon(file.mimeType);
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
            >
              <Icon className="w-5 h-5 text-muted-foreground shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{file.originalName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {file.mimeType.split('/').pop()}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(file.size)} — {new Date(file.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {getStatusIcon(file.status)}
                <span className="text-xs text-muted-foreground capitalize">{file.status}</span>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(file.id)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(file.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
