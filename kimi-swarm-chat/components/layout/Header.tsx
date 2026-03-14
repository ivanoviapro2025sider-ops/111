import { Settings } from "lucide-react";
import Link from "next/link";

export function Header({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </Link>
    </header>
  );
}
