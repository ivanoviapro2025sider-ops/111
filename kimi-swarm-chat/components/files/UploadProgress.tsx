import { Progress } from "@/components/ui/progress";

export function UploadProgress({
  progress,
  speedLabel,
  etaLabel,
}: {
  progress: number;
  speedLabel?: string;
  etaLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <Progress value={progress} />
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{progress.toFixed(0)}%</span>
        <span>
          {speedLabel || "—"} {etaLabel ? `• ETA: ${etaLabel}` : ""}
        </span>
      </div>
    </div>
  );
}
