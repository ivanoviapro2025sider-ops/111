"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  disabled?: boolean;
  onSend: (value: string) => Promise<void> | void;
  onAttach?: () => void;
}

export function ChatInput({ disabled, onSend, onAttach }: ChatInputProps) {
  const [value, setValue] = useState("");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <Textarea
        placeholder="Напишите сообщение агенту..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-24 resize-none border-none bg-transparent p-0 focus:border-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onAttach} disabled={!onAttach}>
          <Paperclip className="mr-1 h-4 w-4" />
          Attach
        </Button>
        <Button
          onClick={async () => {
            const text = value.trim();
            if (!text) return;
            await onSend(text);
            setValue("");
          }}
          disabled={disabled || !value.trim()}
        >
          <Send className="mr-1 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
