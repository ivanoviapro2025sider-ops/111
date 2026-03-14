import Link from "next/link";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
      <p className="text-sm text-zinc-300">KIMI Swarm Chat Service</p>
      <div className="flex items-center gap-3 text-sm">
        <Link href="/settings" className="text-zinc-300 hover:text-white">
          Settings
        </Link>
        <Link href="/agents" className="text-zinc-300 hover:text-white">
          Agents
        </Link>
      </div>
    </header>
  );
}
