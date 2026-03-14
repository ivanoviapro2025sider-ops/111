'use client';

import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { InstructionStep } from '@/types/instruction';

interface StepCardProps {
  step: InstructionStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
}

export function StepCard({
  step,
  index,
  isSelected,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  className,
}: StepCardProps) {
  const preview = step.description.slice(0, 60) + (step.description.length > 60 ? '…' : '');

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={onSelect}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardContent className="flex items-start gap-2 p-3">
        {onDragStart && (
          <div
            className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {index + 1}.
            </span>
            <span className="truncate font-medium">{step.title || 'Без названия'}</span>
          </div>
          {preview && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
          )}
        </div>
        {step.screenshot?.path && (
          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted">
            <img
              src={step.screenshot.path}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
