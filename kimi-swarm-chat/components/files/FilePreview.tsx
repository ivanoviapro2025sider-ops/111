import type { FileAttachment } from "@/types/file";

export function FilePreview({ file }: { file: FileAttachment | null }) {
  if (!file) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        Выберите файл для предпросмотра.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-100">{file.name}</h3>
      <p className="text-xs text-zinc-400">MIME: {file.mimeType}</p>
      <p className="text-xs text-zinc-400">Статус: {file.status}</p>
    </div>
  );
}
