import { Badge } from "@/components/ui/badge";

interface AgentIndicatorProps {
  name?: string;
  color?: string;
  avatar?: string;
}

export function AgentIndicator({ name, color = "#6366f1", avatar = "🤖" }: AgentIndicatorProps) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
        style={{ backgroundColor: color }}
      >
        {avatar}
      </span>
      <Badge>{name}</Badge>
    </div>
  );
}
