'use client';

import { UploadedFile } from '@/types/file';
import { FileText, Trash2, Eye, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/lib/utils';

interface FileListProps {
  files: UploadedFile[];
  onDelete: (id: string) => void;
  onProcess: (id: string) => void;
  onPreview: (file: UploadedFile) => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  processing: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  processed: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
};

export function FileList({ files, onDelete, onProcess, onPreview }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No files uploaded yet</p>
      </div>
    );
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{file.originalName}</span>
              {statusIcons[file.status]}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {file.mimeType.split('/').pop()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {file.status === 'pending' && (
              <Button variant="ghost" size="sm" onClick={() => onProcess(file.id)} className="text-xs">
                Process
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPreview(file)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(file.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>Total: {files.length} files</span>
        <span>{formatFileSize(totalSize)}</span>
      </div>
    </div>
  );
}
