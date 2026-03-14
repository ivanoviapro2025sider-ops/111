"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const titleMap: Record<string, string> = {
  "/chat": "Chat",
  "/agents": "Agents",
  "/files": "Files",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const key = Object.keys(titleMap).find((item) => pathname.startsWith(item)) || "/chat";
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">{titleMap[key]}</h2>
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <Link href="/settings" className="hover:text-zinc-100">
          ⚙ Settings
        </Link>
      </div>
    </header>
  );
}
