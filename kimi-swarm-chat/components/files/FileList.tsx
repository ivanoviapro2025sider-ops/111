"use client";

import { Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import type { FileRecord } from "@/types/file";

interface FileListProps {
  files: FileRecord[];
  onPreview?: (file: FileRecord) => void;
  onDelete?: (id: string) => Promise<void> | void;
  onProcess?: (id: string) => Promise<void> | void;
}

export function FileList({ files, onPreview, onDelete, onProcess }: FileListProps) {
  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Uploaded files</h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-zinc-200">{file.originalName}</p>
              <p className="text-zinc-400">
                {formatBytes(file.size)} · {file.extension} · {file.status}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {file.status !== "processed" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onProcess?.(file.id)}
                  disabled={!onProcess}
                >
                  {file.status === "processing" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Process
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onPreview?.(file)}
                disabled={!onPreview}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                onClick={() => onDelete?.(file.id)}
                disabled={!onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
