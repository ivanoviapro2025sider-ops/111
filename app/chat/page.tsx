'use client';

import { useEffect } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useAgentStore } from '@/stores/agentStore';
import { useChatStore } from '@/stores/chatStore';

export default function ChatPage() {
  const { setAgents } = useAgentStore();
  const { setChats } = useChatStore();

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        if (data.agents) setAgents(data.agents);
      })
      .catch(() => {});

    fetch('/api/chat')
      .then((r) => r.json())
      .then((data) => {
        if (data.chats) setChats(data.chats);
      })
      .catch(() => {});
  }, [setAgents, setChats]);

  return (
    <div className="flex h-full">
      <ChatWindow />
    </div>
  );
}
