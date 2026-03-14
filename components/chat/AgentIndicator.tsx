import { Badge } from '@/components/ui/badge';

export function AgentIndicator({ name, color, model }: { name?: string; color?: string; model?: string }) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color ?? '#6366f1' }} />
      <div>
        <div className="text-sm font-medium text-white">{name}</div>
        {model ? <div className="text-xs text-white/45">{model}</div> : null}
      </div>
      <Badge className="ml-auto">Active</Badge>
    </div>
  );
}
