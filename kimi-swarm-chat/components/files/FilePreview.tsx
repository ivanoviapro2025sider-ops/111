"use client";

import type { FileRecord } from "@/types/file";

interface FilePreviewProps {
  file: FileRecord | null;
}

export function FilePreview({ file }: FilePreviewProps) {
  if (!file) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
        Select file to preview metadata.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{file.originalName}</h3>
      <div className="space-y-1 text-xs text-zinc-400">
        <p>ID: {file.id}</p>
        <p>Status: {file.status}</p>
        <p>MIME: {file.mimeType}</p>
        <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        <p>Path: {file.path}</p>
      </div>
      {file.metadata ? (
        <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-400">
          {JSON.stringify(file.metadata, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
