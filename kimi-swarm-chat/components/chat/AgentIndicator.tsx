interface AgentIndicatorProps {
  name?: string;
  color?: string;
  avatar?: string;
}

export function AgentIndicator({ name, color = "#6366f1", avatar = "🤖" }: AgentIndicatorProps) {
  if (!name) return null;

  return (
    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
      <span>{avatar}</span>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{name}</span>
    </div>
  );
}
