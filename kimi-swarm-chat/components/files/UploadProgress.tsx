interface UploadProgressProps {
  percent: number;
  speedLabel?: string;
  etaLabel?: string;
}

export function UploadProgress({ percent, speedLabel, etaLabel }: UploadProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs text-zinc-400">
        {clamped.toFixed(1)}% {speedLabel ? `— ${speedLabel}` : ""}{" "}
        {etaLabel ? `— ETA: ${etaLabel}` : ""}
      </p>
    </div>
  );
}
