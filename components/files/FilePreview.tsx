'use client';

import { UploadedFile } from '@/types/file';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatFileSize } from '@/lib/utils';

interface FilePreviewProps {
  file: UploadedFile | null;
  open: boolean;
  onClose: () => void;
}

export function FilePreview({ file, open, onClose }: FilePreviewProps) {
  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {file.originalName}
            <Badge variant="outline" className="text-xs">
              {formatFileSize(file.size)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Type: {file.mimeType}</span>
            <span>Status: {file.status}</span>
          </div>

          {file.processedContent ? (
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">{file.processedContent}</pre>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-40 rounded-md border">
              <p className="text-sm text-muted-foreground">
                {file.status === 'processing' ? 'Processing...' : 'File not yet processed'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
