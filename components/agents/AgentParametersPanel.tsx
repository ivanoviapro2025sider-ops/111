'use client';

import { Agent } from '@/types/agent';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface AgentParametersPanelProps {
  agent: Partial<Agent>;
  onChange: (field: string, value: unknown) => void;
}

const PARAMETERS = [
  { label: 'Temperature', field: 'temperature', min: 0, max: 2, step: 0.1, default: 1.0 },
  { label: 'Top P', field: 'topP', min: 0, max: 1, step: 0.05, default: 1.0 },
  { label: 'Top K', field: 'topK', min: 0, max: 500, step: 1, default: 0 },
  { label: 'Frequency Penalty', field: 'frequencyPenalty', min: -2, max: 2, step: 0.1, default: 0 },
  { label: 'Presence Penalty', field: 'presencePenalty', min: -2, max: 2, step: 0.1, default: 0 },
  { label: 'Repetition Penalty', field: 'repetitionPenalty', min: 0, max: 2, step: 0.1, default: 1.0 },
  { label: 'Min P', field: 'minP', min: 0, max: 1, step: 0.05, default: 0 },
  { label: 'Top A', field: 'topA', min: 0, max: 1, step: 0.05, default: 0 },
] as const;

export function AgentParametersPanel({ agent, onChange }: AgentParametersPanelProps) {
  const resetDefaults = () => {
    for (const param of PARAMETERS) {
      onChange(param.field, param.default);
    }
    onChange('maxTokens', 4096);
    onChange('seed', null);
  };

  return (
    <div className="space-y-5">
      {PARAMETERS.map(({ label, field, min, max, step }) => (
        <div key={field} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{label}</Label>
            <Input
              type="number"
              className="w-20 h-7 text-xs"
              value={(agent[field as keyof typeof agent] as number) ?? 0}
              onChange={(e) => onChange(field, parseFloat(e.target.value))}
              step={step}
              min={min}
              max={max}
            />
          </div>
          <Slider
            value={[(agent[field as keyof typeof agent] as number) ?? 0]}
            onValueChange={([v]) => onChange(field, v)}
            min={min}
            max={max}
            step={step}
          />
        </div>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input
            type="number"
            value={agent.maxTokens ?? 4096}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
            min={1}
            max={131072}
          />
        </div>
        <div className="space-y-2">
          <Label>Seed</Label>
          <Input
            type="number"
            value={agent.seed ?? ''}
            onChange={(e) => onChange('seed', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Random"
          />
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={resetDefaults} className="gap-1">
        <RotateCcw className="h-3 w-3" />
        Reset to Defaults
      </Button>
    </div>
  );
}
