export function ModelSelector({ value, models, onChange }: { value: string; models: Array<{ id: string; name?: string; pricing?: { prompt?: string; completion?: string }; context_length?: number }>; onChange: (value: string) => void; }) {
  return (
    <div className="space-y-2">
      <select className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white" value={value} onChange={(event) => onChange(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name ?? model.id}</option>)}</select>
      <div className="grid gap-2 md:grid-cols-2">{models.filter((model) => model.id === value).map((model) => <div key={model.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60"><div>Context: {model.context_length ?? 'n/a'}</div><div>Prompt: {model.pricing?.prompt ?? 'n/a'} / 1M</div><div>Completion: {model.pricing?.completion ?? 'n/a'} / 1M</div></div>)}</div>
    </div>
  );
}
