import { Navigation } from "@/components/layout/Navigation";

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-zinc-800 bg-zinc-950/70 p-4 lg:block">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">KIMI Swarm</p>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">Chat Service</h1>
      </div>
      <Navigation />
    </aside>
  );
}
