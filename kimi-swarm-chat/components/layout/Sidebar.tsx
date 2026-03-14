import { Navigation } from "@/components/layout/Navigation";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-800 bg-[#0f1021] p-4 lg:block">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">KIMI Swarm Chat</h1>
        <p className="text-xs text-zinc-400">OpenRouter + multi-agent orchestration</p>
      </div>
      <Navigation />
    </aside>
  );
}
