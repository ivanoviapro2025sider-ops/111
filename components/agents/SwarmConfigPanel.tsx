import type { AgentConfig } from '@/types/agent';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function SwarmConfigPanel({ value, onChange }: { value: AgentConfig; onChange: (patch: Partial<AgentConfig>) => void }) {
  return (
    <div className="grid gap-4">
      <label className="block text-sm text-white/70">Handoff conditions<Textarea className="mt-2" value={value.handoffConditions} onChange={(event) => onChange({ handoffConditions: event.target.value })} /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/70">Max turns<Input className="mt-2" type="number" value={value.maxTurns ?? ''} onChange={(event) => onChange({ maxTurns: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className="block text-sm text-white/70">Tool choice<select className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white" value={value.toolChoice} onChange={(event) => onChange({ toolChoice: event.target.value as AgentConfig['toolChoice'] })}><option value="none">none</option><option value="auto">auto</option><option value="required">required</option></select></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{[['executeTools', 'Execute tools'], ['stream', 'Stream'], ['debug', 'Debug'], ['parallelToolCalls', 'Parallel tool calls']].map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75"><input type="checkbox" checked={Boolean(value[key as keyof AgentConfig])} onChange={(event) => onChange({ [key]: event.target.checked } as Partial<AgentConfig>)} />{label}</label>)}</div>
    </div>
  );
}
