import { formatBytes } from '@/lib/utils';

export function UploadProgress({ progress, speed, eta }: { progress: number; speed?: number; eta?: number }) {
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} /></div>
      <div className="text-xs text-white/50">{Math.round(progress)}% {speed ? `- ${formatBytes(speed)}/s` : ''} {eta ? `- ETA ${eta}s` : ''}</div>
    </div>
  );
}
