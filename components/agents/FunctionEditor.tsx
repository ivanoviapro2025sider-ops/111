import type { AgentFunctionInput } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function FunctionEditor({ functions, onChange }: { functions: AgentFunctionInput[]; onChange: (functions: AgentFunctionInput[]) => void; }) {
  return (
    <div className="space-y-4">
      {functions.map((fn, index) => <div key={fn.id ?? index} className="rounded-3xl border border-white/10 bg-white/5 p-4"><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm text-white/70">Name<Input className="mt-2" value={fn.name} onChange={(event) => onChange(functions.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label><label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/75 self-end"><input type="checkbox" checked={fn.isHandoff} onChange={(event) => onChange(functions.map((item, itemIndex) => itemIndex === index ? { ...item, isHandoff: event.target.checked } : item))} />Handoff function</label></div><label className="mt-4 block text-sm text-white/70">Description<Textarea className="mt-2 min-h-[90px]" value={fn.description} onChange={(event) => onChange(functions.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label><label className="mt-4 block text-sm text-white/70">JSON Schema<Textarea className="mt-2 min-h-[120px] font-mono text-xs" value={JSON.stringify(fn.parameters, null, 2)} onChange={(event) => { let parsed: Record<string, unknown> = {}; try { parsed = JSON.parse(event.target.value); } catch {} onChange(functions.map((item, itemIndex) => itemIndex === index ? { ...item, parameters: parsed } : item)); }} /></label><label className="mt-4 block text-sm text-white/70">Implementation<Textarea className="mt-2 min-h-[180px] font-mono text-xs" value={fn.implementation} onChange={(event) => onChange(functions.map((item, itemIndex) => itemIndex === index ? { ...item, implementation: event.target.value } : item))} /></label></div>)}
      <Button variant="secondary" onClick={() => onChange([...functions, { name: 'new_function', description: '', parameters: { type: 'object', properties: {} }, implementation: 'return { ok: true };', isHandoff: false }])}>Add function</Button>
    </div>
  );
}
