import { Navigation } from '@/components/layout/Navigation';

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/20 p-4 lg:block">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.24em] text-white/35">KIMI Swarm Chat</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Control Center</h1>
      </div>
      <Navigation />
    </aside>
  );
}
