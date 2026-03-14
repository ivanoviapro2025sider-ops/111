"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, attachments: string[]) => Promise<void> | void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 flex flex-wrap gap-2 text-xs text-zinc-400">
        {attachments.map((attachment) => (
          <span
            key={attachment}
            className="rounded-full border border-zinc-700 px-2 py-1"
          >
            📎 {attachment}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-20 flex-1 resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          placeholder="Сообщение..."
        />
        <button
          type="button"
          className="rounded-md border border-zinc-700 p-2 text-zinc-300 hover:text-white"
          onClick={() => {
            const raw = window.prompt("Введите file IDs через запятую", attachments.join(","));
            if (raw === null) return;
            setAttachments(
              raw
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            );
          }}
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={async () => {
            const payload = value.trim();
            if (!payload) return;
            setValue("");
            await onSend(payload, attachments);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  );
}
