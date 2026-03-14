'use client';

import { usePathname } from 'next/navigation';
import { Settings, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const pageTitles: Record<string, string> = {
  '/chat': 'Chat',
  '/agents': 'Agents',
  '/files': 'Files',
  '/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([path]) => pathname?.startsWith(path))?.[1] || 'KIMI Swarm Chat';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Search className="h-4 w-4" />
        </Button>
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
