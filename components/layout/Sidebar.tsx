'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores/chatStore';
import {
  MessageSquare,
  Bot,
  FolderOpen,
  Settings,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { chats, currentChatId, setCurrentChat, fetchChats, createChat, deleteChat } =
    useChatStore();

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const navItems = [
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/agents', label: 'Agents', icon: Bot },
    { href: '/files', label: 'Files', icon: FolderOpen },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <Link href="/chat" className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">KIMI Swarm</span>
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'}
              className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
              size={collapsed ? 'icon' : 'default'}
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span className="ml-2">{item.label}</span>}
            </Button>
          </Link>
        ))}
      </nav>

      {!collapsed && pathname.startsWith('/chat') && (
        <>
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Chats</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => createChat()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors',
                    currentChatId === chat.id && 'bg-accent'
                  )}
                  onClick={() => setCurrentChat(chat.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{chat.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
