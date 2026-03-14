import type { AgentConfig } from '@/types/agent';
import { Input } from '@/components/ui/input';

export function AgentParametersPanel({ value, onChange }: { value: AgentConfig; onChange: (patch: Partial<AgentConfig>) => void; }) {
  const fields: Array<{ key: keyof AgentConfig; label: string; min?: number; max?: number; step?: number }> = [
    { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1 },
    { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.05 },
    { key: 'topK', label: 'Top K', min: 0, max: 500, step: 1 },
    { key: 'frequencyPenalty', label: 'Frequency penalty', min: -2, max: 2, step: 0.1 },
    { key: 'presencePenalty', label: 'Presence penalty', min: -2, max: 2, step: 0.1 },
    { key: 'repetitionPenalty', label: 'Repetition penalty', min: 0, max: 2, step: 0.1 },
    { key: 'minP', label: 'Min P', min: 0, max: 1, step: 0.05 },
    { key: 'topA', label: 'Top A', min: 0, max: 1, step: 0.05 },
    { key: 'maxTokens', label: 'Max tokens', min: 1, max: 131072, step: 1 },
  ];
  return <div className="grid gap-4 md:grid-cols-2">{fields.map((field) => <label key={String(field.key)} className="block text-sm text-white/70">{field.label}<Input className="mt-2" type="number" step={field.step} min={field.min} max={field.max} value={String(value[field.key] ?? '')} onChange={(event) => onChange({ [field.key]: Number(event.target.value) } as Partial<AgentConfig>)} /></label>)}</div>;
}
