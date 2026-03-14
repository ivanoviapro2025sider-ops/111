'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface FrameItem {
  id: string;
  filePath: string;
  thumbnailPath: string;
  timestampFormatted: string;
}

interface FrameGalleryProps {
  frames: FrameItem[];
  className?: string;
}

export function FrameGallery({ frames, className }: FrameGalleryProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameItem | null>(null);

  return (
    <>
      <ScrollArea className={cn('w-full whitespace-nowrap', className)}>
        <div className="flex gap-3 pb-4">
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => setSelectedFrame(frame)}
              className="group flex shrink-0 flex-col items-center overflow-hidden rounded-lg border bg-muted/50 transition-colors hover:border-primary hover:bg-muted"
            >
              <div className="relative aspect-video w-32 overflow-hidden sm:w-40">
                <img
                  src={frame.thumbnailPath || frame.filePath}
                  alt={`Frame ${frame.timestampFormatted}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <span className="w-full truncate px-2 py-1.5 text-center text-xs text-muted-foreground">
                {frame.timestampFormatted}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Dialog open={!!selectedFrame} onOpenChange={() => setSelectedFrame(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedFrame?.timestampFormatted}</DialogTitle>
          </DialogHeader>
          {selectedFrame && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <img
                src={selectedFrame.filePath}
                alt={`Frame ${selectedFrame.timestampFormatted}`}
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
