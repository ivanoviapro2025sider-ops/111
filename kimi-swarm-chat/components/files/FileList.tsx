"use client";

import { Eye, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FileRecord } from "@/types/file";

interface FileListProps {
  files: FileRecord[];
  onPreview: (file: FileRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onProcess: (id: string) => Promise<void>;
}

const statusColor: Record<string, string> = {
  UPLOADING: "border-yellow-500/40 text-yellow-300",
  UPLOADED: "border-indigo-500/40 text-indigo-300",
  PROCESSING: "border-yellow-500/40 text-yellow-300",
  PROCESSED: "border-emerald-500/40 text-emerald-300",
  FAILED: "border-red-500/40 text-red-300",
};

export function FileList({ files, onPreview, onDelete, onProcess }: FileListProps) {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
        >
          <div className="space-y-1">
            <p className="text-sm text-zinc-200">{file.originalName}</p>
            <p className="text-xs text-zinc-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.extension || "unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColor[file.status] || ""}>{file.status}</Badge>
            <Button size="sm" variant="ghost" onClick={() => onPreview(file)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onProcess(file.id)}>
              <Play className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void onDelete(file.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
