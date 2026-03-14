"use client";

import { useRef, useState } from "react";
import { Paperclip, SendHorizonal } from "lucide-react";
import type { FileAttachment } from "@/types/file";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  disabled?: boolean;
  attachments: FileAttachment[];
  onSend: (text: string) => void;
  onAttach: (files: File[]) => Promise<void>;
}

export function ChatInput({ disabled, attachments, onSend, onAttach }: ChatInputProps) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1 text-xs text-zinc-300">
          {attachments.map((item) => (
            <span
              key={item.id}
              className="rounded-full border border-zinc-700 px-2 py-0.5"
            >
              {item.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите сообщение..."
          className="min-h-[44px] resize-y"
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={() => {
              const payload = text.trim();
              if (!payload) return;
              setText("");
              onSend(payload);
            }}
            disabled={disabled || !text.trim()}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;
          await onAttach(files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
