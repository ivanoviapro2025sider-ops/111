export function AgentIndicator({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{name}</span>
    </div>
  );
}
