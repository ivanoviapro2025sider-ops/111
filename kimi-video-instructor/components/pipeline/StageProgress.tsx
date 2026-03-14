'use client';

import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { StageStatus } from '@/types/pipeline';

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (status === 'error') return <AlertCircle className="h-5 w-5 text-destructive" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

interface StageProgressProps {
  stageName: string;
  status: StageStatus;
  progress?: number;
  message?: string;
  className?: string;
}

export function StageProgress({
  stageName,
  status,
  progress = 0,
  message,
  className,
}: StageProgressProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="font-medium">{stageName}</span>
      </div>
      {status === 'running' && (
        <>
          <Progress value={progress} className="h-2" />
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </>
      )}
      {status === 'completed' && message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      {status === 'error' && message && (
        <p className="text-sm text-destructive">{message}</p>
      )}
    </div>
  );
}
