'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Bot, Files, MessageSquare, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Users },
  { href: '/files', label: 'Files', icon: Files },
  { href: '/settings', label: 'Settings', icon: Settings },
] satisfies Array<{ href: Route; label: string; icon: typeof MessageSquare }>;

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
              active ? 'bg-indigo-500/15 text-white shadow-glow' : 'text-white/65 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-emerald-500/10 p-4 text-sm text-white/80">
        <Bot className="h-5 w-5 text-indigo-300" />
        KIMI Swarm orchestration
      </div>
    </nav>
  );
}
