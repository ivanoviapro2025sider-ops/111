'use client';

import { Badge } from '@/components/ui/badge';
import type { ProjectStatus as ProjectStatusType } from '@/types/project';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<
  ProjectStatusType,
  { className: string; label: string }
> = {
  uploading: {
    className: 'border-yellow-500/50 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    label: 'Uploading',
  },
  uploaded: {
    className: 'border-blue-500/50 bg-blue-500/20 text-blue-600 dark:text-blue-400',
    label: 'Uploaded',
  },
  processing: {
    className: 'border-purple-500/50 bg-purple-500/20 text-purple-600 dark:text-purple-400',
    label: 'Processing',
  },
  review: {
    className: 'border-orange-500/50 bg-orange-500/20 text-orange-600 dark:text-orange-400',
    label: 'Review',
  },
  completed: {
    className: 'border-green-500/50 bg-green-500/20 text-green-600 dark:text-green-400',
    label: 'Completed',
  },
  error: {
    className: 'border-red-500/50 bg-red-500/20 text-red-600 dark:text-red-400',
    label: 'Error',
  },
};

interface ProjectStatusProps {
  status: ProjectStatusType;
  progress?: number;
  className?: string;
}

export function ProjectStatus({ status, progress, className }: ProjectStatusProps) {
  const { className: statusClassName, label } = STATUS_STYLES[status];
  const showProgress = status === 'processing' && progress !== undefined;

  return (
    <Badge
      variant="outline"
      className={cn(statusClassName, className)}
    >
      {showProgress ? `${label} ${Math.round(progress)}%` : label}
    </Badge>
  );
}
