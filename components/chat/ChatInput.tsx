'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, attachments?: string[]) => void;
  disabled?: boolean;
  onFileSelect?: (files: FileList) => void;
  pendingFiles?: Array<{ id: string; name: string; size: number }>;
  onRemoveFile?: (id: string) => void;
}

export default function ChatInput({ onSend, disabled, onFileSelect, pendingFiles, onRemoveFile }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed && (!pendingFiles || pendingFiles.length === 0)) return;
    onSend(trimmed, pendingFiles?.map(f => f.id));
    setMessage('');
  }, [message, onSend, pendingFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0 && onFileSelect) {
        onFileSelect(e.dataTransfer.files);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="border-t bg-card p-4">
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs"
            >
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatBytes(file.size)}</span>
              {onRemoveFile && (
                <button onClick={() => onRemoveFile(file.id)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-end gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mb-0.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && onFileSelect) {
              onFileSelect(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'placeholder:text-muted-foreground',
              'scrollbar-thin',
              disabled && 'opacity-50'
            )}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || (!message.trim() && (!pendingFiles || pendingFiles.length === 0))}
          size="icon"
          className="shrink-0 mb-0.5 rounded-xl"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
