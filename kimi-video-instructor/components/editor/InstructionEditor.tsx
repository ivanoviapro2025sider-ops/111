'use client';

import { useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StepCard } from './StepCard';
import { StepText } from './StepText';
import { cn } from '@/lib/utils';
export function InstructionEditor() {
  const {
    instruction,
    selectedStepIndex,
    isDirty,
    selectStep,
    updateStep,
    reorderSteps,
  } = useEditorStore();

  const selectedStep = instruction?.steps[selectedStepIndex] ?? null;

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
      reorderSteps(fromIndex, toIndex);
    },
    [reorderSteps]
  );

  if (!instruction) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Выберите инструкцию для редактирования
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_280px]">
      <div className="flex flex-col border-r">
        <h3 className="border-b px-4 py-3 font-semibold">Шаги</h3>
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-4">
            {instruction.steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isSelected={selectedStepIndex === index}
                onSelect={() => selectStep(index)}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-col min-w-0">
        {selectedStep ? (
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              {selectedStep.screenshot?.path ? (
                <img
                  src={selectedStep.screenshot.path}
                  alt={selectedStep.title}
                  className="w-full object-contain max-h-[300px]"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  Нет скриншота
                </div>
              )}
            </div>
            <StepText
              step={selectedStep}
              onUpdate={(updates) => updateStep(selectedStep.id, updates)}
              isDirty={isDirty}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Выберите шаг
          </div>
        )}
      </div>

      <div className="flex flex-col border-l">
        <h3 className="border-b px-4 py-3 font-semibold">Чат</h3>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-50" />
          <p className="text-sm">Панель чата</p>
        </div>
      </div>
    </div>
  );
}
