"use client";

import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  disabled?: boolean;
  onSend: (content: string, files: File[]) => Promise<void> | void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    await onSend(trimmed, files);
    setValue("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <span
              key={`${file.name}-${file.lastModified}`}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              {file.name}
            </span>
          ))}
        </div>
      )}
      <Textarea
        rows={3}
        placeholder="Введите сообщение..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) =>
              setFiles(event.target.files ? Array.from(event.target.files) : [])
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="mr-1 h-4 w-4" />
            Attach
          </Button>
        </div>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={disabled}>
          <Send className="mr-1 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
