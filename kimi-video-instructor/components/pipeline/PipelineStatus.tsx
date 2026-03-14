'use client';

import {
  CheckCircle2,
  Loader2,
  Circle,
  AlertCircle,
  Upload,
  Music,
  FileText,
  Image,
  Link2,
  Brain,
  FileOutput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  STAGE_LABELS,
  PIPELINE_STAGES_ORDER,
  PipelineState,
  PipelineStage,
  StageStatus,
} from '@/types/pipeline';

const STAGE_ICONS: Record<PipelineStage, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  extractAudio: Music,
  transcribe: FileText,
  extractFrames: Image,
  align: Link2,
  analyze: Brain,
  generate: FileOutput,
};

function formatDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (status === 'error') return <AlertCircle className="h-5 w-5 text-destructive" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

export function PipelineStatus({ pipeline }: { pipeline: PipelineState }) {
  return (
    <div className="flex flex-col gap-0">
      {PIPELINE_STAGES_ORDER.map((stage, index) => {
        const state = pipeline.stages[stage];
        const Icon = STAGE_ICONS[stage];
        const isLast = index === PIPELINE_STAGES_ORDER.length - 1;
        const duration = formatDuration(state.startedAt, state.completedAt);

        return (
          <div key={stage} className="flex">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                  state.status === 'completed' && 'border-green-500 bg-green-500/10',
                  state.status === 'running' && 'border-primary bg-primary/10',
                  state.status === 'error' && 'border-destructive bg-destructive/10',
                  state.status === 'pending' && 'border-muted bg-muted/50'
                )}
              >
                {state.status === 'pending' ? (
                  <Icon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <StatusIcon status={state.status} />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[24px]',
                    state.status === 'completed' ? 'bg-green-500/30' : 'bg-muted'
                  )}
                />
              )}
            </div>
            <div className="ml-4 flex-1 pb-6">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'font-medium',
                    state.status === 'completed' && 'text-green-600 dark:text-green-400',
                    state.status === 'error' && 'text-destructive'
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
                {duration && (
                  <span className="text-xs text-muted-foreground">{duration}</span>
                )}
              </div>
              {state.status === 'running' && (
                <div className="mt-2 space-y-1">
                  <Progress value={state.progress} className="h-2" />
                  {state.message && (
                    <p className="text-xs text-muted-foreground">{state.message}</p>
                  )}
                </div>
              )}
              {state.status === 'error' && state.message && (
                <p className="mt-1 text-sm text-destructive">{state.message}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
