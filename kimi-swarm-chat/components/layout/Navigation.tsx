"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Bot, Files, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/files", label: "Files", icon: Files },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-indigo-500 text-white" : "text-zinc-300 hover:bg-zinc-800",
            )}
          >
            <Icon className="h-4 w-4" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
