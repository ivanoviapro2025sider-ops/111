import type { UploadedFile } from "@/types/file";

interface FileListProps {
  files: UploadedFile[];
  onDelete: (id: string) => Promise<void> | void;
  onProcess: (id: string) => Promise<void> | void;
  onPreview: (file: UploadedFile) => void;
}

export function FileList({ files, onDelete, onProcess, onPreview }: FileListProps) {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium text-zinc-100">{file.originalName}</p>
            <p className="text-xs text-zinc-400">
              {(Number(file.size) / 1024 / 1024).toFixed(2)} MB — {file.extension} — {file.status}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => onPreview(file)}
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300"
            >
              👁
            </button>
            <button
              type="button"
              onClick={() => onProcess(file.id)}
              className="rounded border border-indigo-600 px-2 py-1 text-indigo-200"
            >
              Process
            </button>
            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="rounded border border-red-600 px-2 py-1 text-red-200"
            >
              🗑
            </button>
          </div>
        </div>
      ))}
      {!files.length && <p className="text-sm text-zinc-500">No uploaded files.</p>}
    </div>
  );
}
