'use client';

import { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InstructionStep } from '@/types/instruction';

interface StepTextProps {
  step: InstructionStep;
  onUpdate: (updates: Partial<InstructionStep>) => void;
  isDirty?: boolean;
  className?: string;
}

function ListEditor({
  items,
  onChange,
  onAdd,
  onRemove,
  placeholder,
  className,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(i)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Добавить
      </Button>
    </div>
  );
}

export function StepText({
  step,
  onUpdate,
  isDirty = false,
  className,
}: StepTextProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [step.description]);

  const tips = step.tips ?? [];
  const warnings = step.warnings ?? [];

  const handleTipsAdd = () => onUpdate({ tips: [...tips, ''] });
  const handleTipsRemove = (i: number) => onUpdate({ tips: tips.filter((_, idx) => idx !== i) });
  const handleTipsChange = (next: string[]) => onUpdate({ tips: next });
  const handleWarningsAdd = () => onUpdate({ warnings: [...warnings, ''] });
  const handleWarningsRemove = (i: number) =>
    onUpdate({ warnings: warnings.filter((_, idx) => idx !== i) });
  const handleWarningsChange = (next: string[]) => onUpdate({ warnings: next });

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Название</label>
        {isDirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Не сохранено</span>
        )}
      </div>
      <Input
        value={step.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Название шага"
      />

      <div>
        <label className="text-sm font-medium">Описание</label>
        <Textarea
          ref={textareaRef}
          value={step.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Подробное описание шага..."
          className="mt-1 min-h-[100px] resize-none overflow-hidden"
          rows={4}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Советы</label>
        <ListEditor
          items={tips}
          onChange={handleTipsChange}
          onAdd={handleTipsAdd}
          onRemove={handleTipsRemove}
          placeholder="Добавить совет"
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Предупреждения</label>
        <ListEditor
          items={warnings}
          onChange={handleWarningsChange}
          onAdd={handleWarningsAdd}
          onRemove={handleWarningsRemove}
          placeholder="Добавить предупреждение"
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Заметки</label>
        <Textarea
          value={step.notes ?? ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Внутренние заметки..."
          className="mt-1 min-h-[60px]"
          rows={2}
        />
      </div>
    </div>
  );
}
