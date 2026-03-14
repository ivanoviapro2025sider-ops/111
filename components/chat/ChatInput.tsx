'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading = false, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
    setMessage('');
    setAttachedFiles([]);
  }, [message, attachedFiles, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  return (
    <div className="border-t bg-card p-4" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{f.name}</span>
              <button
                className="text-muted-foreground hover:text-foreground ml-1"
                onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || isLoading}
          className={cn(
            'min-h-[44px] max-h-[200px] resize-none',
            'focus-visible:ring-1'
          )}
          rows={1}
        />

        <Button
          className="shrink-0"
          size="icon"
          onClick={handleSend}
          disabled={disabled || isLoading || (!message.trim() && attachedFiles.length === 0)}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
