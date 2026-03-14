import { Navigation } from "./Navigation";

export function Sidebar() {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-zinc-800 bg-zinc-950/80 p-4 md:block">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">KIMI Swarm Chat</h1>
        <p className="text-xs text-zinc-400">OpenRouter + multi-agent orchestration</p>
      </div>
      <Navigation />
    </aside>
  );
}
