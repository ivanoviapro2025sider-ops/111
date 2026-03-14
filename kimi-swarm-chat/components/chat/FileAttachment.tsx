"use client";

import { Paperclip } from "lucide-react";

export function FileAttachment({
  name,
  size,
}: {
  name: string;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
      <Paperclip className="h-3.5 w-3.5" />
      <span>{name}</span>
      {size ? <span className="text-zinc-500">{(size / 1024 / 1024).toFixed(2)} MB</span> : null}
    </div>
  );
}
