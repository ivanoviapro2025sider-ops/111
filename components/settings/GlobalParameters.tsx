import { Input } from '@/components/ui/input';

export function GlobalParameters({ value, onChange }: { value: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void; }) {
  const numericFields = [['timeout', 'Timeout (ms)'], ['retryCount', 'Retry count'], ['retryDelay', 'Retry delay'], ['defaultTemperature', 'Temperature'], ['defaultTopP', 'Top P'], ['defaultTopK', 'Top K'], ['defaultMaxTokens', 'Max tokens'], ['defaultMaxTurns', 'Max turns'], ['defaultChunkSize', 'Chunk size']];
  return <div className="grid gap-4 md:grid-cols-2">{numericFields.map(([key, label]) => <label key={key} className="block text-sm text-white/70">{label}<Input className="mt-2" type="number" value={String(value[key] ?? '')} onChange={(event) => onChange({ [key]: Number(event.target.value) })} /></label>)}</div>;
}
