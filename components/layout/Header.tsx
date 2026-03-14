'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Search, Settings, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/stores/settingsStore';
import Link from 'next/link';

const pageTitles: Record<string, string> = {
  '/chat': 'Chat',
  '/agents': 'Agents',
  '/files': 'Files',
  '/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useSettingsStore();

  const title = Object.entries(pageTitles).find(([path]) => pathname?.startsWith(path))?.[1] || 'KIMI Swarm Chat';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." className="w-64 pl-8 h-8" />
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
