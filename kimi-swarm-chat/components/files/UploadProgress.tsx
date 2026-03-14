interface UploadProgressProps {
  progress: number;
  speedText?: string;
  etaText?: string;
}

export function UploadProgress({ progress, speedText, etaText }: UploadProgressProps) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-zinc-400">
        {progress.toFixed(0)}% {speedText ? `— ${speedText}` : ""} {etaText ? `— ETA: ${etaText}` : ""}
      </p>
    </div>
  );
}
