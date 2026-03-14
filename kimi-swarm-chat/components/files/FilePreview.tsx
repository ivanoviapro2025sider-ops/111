import type { UploadedFile } from "@/types/file";

interface FilePreviewProps {
  file: UploadedFile | null;
}

export function FilePreview({ file }: FilePreviewProps) {
  if (!file) {
    return (
      <section className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
        Select file to preview.
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm">
      <h3 className="font-semibold text-zinc-100">{file.originalName}</h3>
      <p className="text-xs text-zinc-400">
        {file.mimeType} · {(Number(file.size) / 1024 / 1024).toFixed(2)} MB
      </p>
      <pre className="max-h-72 overflow-y-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
        {file.processingOutput?.slice(0, 6000) ?? "No processing output yet."}
      </pre>
    </section>
  );
}
