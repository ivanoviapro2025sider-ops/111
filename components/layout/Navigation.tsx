'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Bot, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/files', label: 'Files', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
