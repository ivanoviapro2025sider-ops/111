'use client';

import { FileText, Image, Music, Video, Archive, Code } from 'lucide-react';
import { formatFileSize, getFileExtension } from '@/lib/utils';

interface FileAttachmentProps {
  name: string;
  size: number;
  mimeType?: string;
  onClick?: () => void;
}

function getFileIcon(name: string) {
  const ext = getFileExtension(name);
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return Image;
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return Music;
  if (['.mp4', '.webm', '.avi', '.mkv'].includes(ext)) return Video;
  if (['.zip', '.tar', '.rar', '.7z', '.gz'].includes(ext)) return Archive;
  if (['.js', '.ts', '.py', '.java', '.cpp', '.rs', '.go'].includes(ext)) return Code;
  return FileText;
}

export function FileAttachment({ name, size, onClick }: FileAttachmentProps) {
  const Icon = getFileIcon(name);

  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-card p-2 cursor-pointer hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">{name}</span>
        <span className="text-[10px] text-muted-foreground">{formatFileSize(size)}</span>
      </div>
    </div>
  );
}
