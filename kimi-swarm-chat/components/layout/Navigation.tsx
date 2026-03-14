"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/agents", label: "Agents" },
  { href: "/files", label: "Files" },
  { href: "/settings", label: "Settings" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm transition-colors hover:bg-zinc-800",
            pathname.startsWith(link.href) ? "bg-zinc-800 text-white" : "text-zinc-300",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
