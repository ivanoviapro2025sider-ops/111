"use client";

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
      <p className="mb-1 text-xs text-zinc-400">Streaming…</p>
      <p className="whitespace-pre-wrap">{content || "…"}</p>
    </div>
  );
}
