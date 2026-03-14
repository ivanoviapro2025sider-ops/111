'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Header() {
  const { theme, setTheme } = useSettingsStore();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium text-muted-foreground">KIMI Swarm Chat</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
