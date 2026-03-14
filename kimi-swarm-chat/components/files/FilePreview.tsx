import type { FileRecord } from "@/types/file";

export function FilePreview({ file }: { file?: FileRecord }) {
  if (!file) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <p className="text-xs text-zinc-500">Select a file to preview details.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">{file.originalName}</h3>
      <p className="text-xs text-zinc-400">Status: {file.status}</p>
      {file.summary && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-300">Summary</p>
          <p className="whitespace-pre-wrap text-xs text-zinc-400">{file.summary}</p>
        </div>
      )}
      {file.extractedText && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-300">Extracted text</p>
          <pre className="max-h-72 overflow-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-300">
            {file.extractedText.slice(0, 4000)}
          </pre>
        </div>
      )}
    </section>
  );
}
