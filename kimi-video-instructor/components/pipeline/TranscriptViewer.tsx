'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface TranscriptSegmentItem {
  id: number;
  text: string;
  start: number;
  end: number;
}

interface TranscriptViewerProps {
  segments: TranscriptSegmentItem[];
  onTimestampClick?: (seconds: number) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function TranscriptViewer({
  segments,
  onTimestampClick,
  className,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по транскрипту..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="h-[300px] flex-1 pr-4">
        <div className="space-y-2">
          {filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className="flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <button
                type="button"
                onClick={() => onTimestampClick?.(segment.start)}
                className="shrink-0 font-mono text-sm font-medium text-primary hover:underline"
              >
                {formatTime(segment.start)}
              </button>
              <p className="flex-1 text-sm leading-relaxed">{segment.text}</p>
            </div>
          ))}
          {filteredSegments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? 'Ничего не найдено' : 'Нет сегментов'}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
