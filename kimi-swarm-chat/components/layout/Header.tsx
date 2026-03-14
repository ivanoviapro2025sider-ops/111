import { Settings } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur">
      <p className="text-sm text-zinc-300">KIMI Swarm Chat · OpenRouter</p>
      <Link
        href="/settings"
        className="rounded-md border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Settings className="h-4 w-4" />
      </Link>
    </header>
  );
}
