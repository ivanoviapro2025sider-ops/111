'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Bot, FileText, Settings, Plus, Trash2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';

const navItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/files', label: 'Files', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { chats, currentChatId, setCurrentChat, deleteChat } = useChatStore();

  useEffect(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((data) => {
        if (data.chats) {
          useChatStore.getState().setChats(data.chats);
        }
      })
      .catch(() => {});
  }, []);

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      const data = await res.json();
      if (data.chat) {
        useChatStore.getState().addChat(data.chat);
        setCurrentChat(data.chat.id);
      }
    } catch (e) {
      console.error('Failed to create chat:', e);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat?id=${chatId}`, { method: 'DELETE' });
      deleteChat(chatId);
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {!collapsed && (
          <Link href="/chat" className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">KIMI Swarm</span>
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <Separator />

      <nav className="flex flex-col gap-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
                size={collapsed ? 'icon' : 'default'}
              >
                <Icon className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                {!collapsed && item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {!collapsed && pathname?.startsWith('/chat') && (
        <>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">Chats</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewChat}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="flex flex-col gap-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    'group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
                    currentChatId === chat.id && 'bg-accent'
                  )}
                  onClick={() => setCurrentChat(chat.id)}
                >
                  <span className="truncate flex-1">{chat.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDeleteChat(chat.id, e)}
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
