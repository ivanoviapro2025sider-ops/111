'use client';

import { useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const trimmed = textarea.value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    textarea.value = '';
    textarea.style.height = 'auto';
  }, [onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex gap-2 items-end border rounded-lg bg-background p-2">
      <Textarea
        ref={textareaRef}
        placeholder="Type a message..."
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className={cn(
          'min-h-[44px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
          disabled && 'opacity-60'
        )}
        rows={1}
      />
      <Button
        type="button"
        size="icon"
        onClick={handleSubmit}
        disabled={disabled}
        className="shrink-0 h-10 w-10"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
