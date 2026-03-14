'use client';

import { cn } from '@/lib/utils';
import type { Instruction, InstructionStep } from '@/types/instruction';

interface InstructionPreviewProps {
  instruction: Instruction;
  className?: string;
}

function StepBlock({ step, index }: { step: InstructionStep; index: number }) {
  return (
    <div className="break-inside-avoid">
      <div className="flex gap-4">
        <div className="shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {index + 1}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{step.title}</h3>
          {step.screenshot?.path && (
            <div className="my-3 overflow-hidden rounded-lg border">
              <img
                src={step.screenshot.path}
                alt={step.screenshot.caption ?? step.title}
                className="w-full object-contain"
              />
              {step.screenshot.caption && (
                <p className="border-t bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  {step.screenshot.caption}
                </p>
              )}
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{step.description}</p>
          </div>
          {step.tips && step.tips.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-muted-foreground">Советы</h4>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                {step.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          {step.warnings && step.warnings.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Предупреждения
              </h4>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-amber-700 dark:text-amber-300">
                {step.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <hr className="my-6 border-border" />
    </div>
  );
}

export function InstructionPreview({ instruction, className }: InstructionPreviewProps) {
  return (
    <article
      className={cn(
        'mx-auto max-w-3xl bg-background p-8 print:p-0',
        className
      )}
    >
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{instruction.title}</h1>
        {instruction.description && (
          <p className="mt-2 text-muted-foreground">{instruction.description}</p>
        )}
        <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
          <span>{instruction.totalSteps} шагов</span>
          <span>~{instruction.estimatedReadTime} мин чтения</span>
        </div>
      </header>

      <div className="space-y-0">
        {instruction.steps.map((step, index) => (
          <StepBlock key={step.id} step={step} index={index} />
        ))}
      </div>

      <footer className="mt-8 pt-6 border-t text-sm text-muted-foreground">
        <p>Создано из видео: {instruction.metadata.sourceVideo}</p>
        <p>Сгенерировано: {instruction.metadata.generatedAt}</p>
      </footer>
    </article>
  );
}
