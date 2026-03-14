'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Home, FolderOpen, Settings, Menu, X, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-zinc-900 text-zinc-100 transition-transform duration-200 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-6 pt-4 md:pt-0">
            <Film className="h-8 w-8 shrink-0 text-zinc-400" />
            <span className="text-lg font-semibold">KIMI Video Instructor</span>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
