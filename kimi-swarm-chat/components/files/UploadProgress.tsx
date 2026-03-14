"use client";

interface UploadProgressProps {
  progress: number;
  speedMbps?: number;
  etaSeconds?: number;
}

export function UploadProgress({ progress, speedMbps, etaSeconds }: UploadProgressProps) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-zinc-400">
        {progress.toFixed(1)}%{" "}
        {speedMbps ? `— ${speedMbps.toFixed(1)} MB/s` : ""}{" "}
        {etaSeconds ? `— ETA: ${Math.max(0, Math.round(etaSeconds))}s` : ""}
      </p>
    </div>
  );
}
