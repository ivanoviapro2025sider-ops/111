'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAgentStore } from '@/stores/agentStore';
import MessageBubble from './MessageBubble';
import StreamingMessage from './StreamingMessage';
import ChatInput from './ChatInput';
import AgentIndicator from './AgentIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatWindow() {
  const {
    getCurrentChat,
    sendMessage,
    isLoading,
    isStreaming,
    streamingContent,
    streamingAgentName,
    streamingAgentColor,
    createChat,
    currentChatId,
  } = useChatStore();

  const { agents, fetchAgents } = useAgentStore();
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentChat = getCurrentChat();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChat?.messages, streamingContent]);

  const handleSend = (message: string) => {
    sendMessage(message, selectedAgentName || undefined);
  };

  const handleFileSelect = (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }
    fetch('/api/files/upload', { method: 'POST', body: formData });
  };

  if (!currentChatId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Bot className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">KIMI Swarm Chat</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Start a new conversation with KIMI K2 powered agents. Configure multi-agent workflows with
          Swarm architecture.
        </p>
        <Button onClick={() => createChat()} size="lg">
          <MessageSquarePlus className="h-5 w-5 mr-2" />
          New Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          {selectedAgentName && (
            <AgentIndicator
              name={selectedAgentName}
              color={agents.find((a) => a.name === selectedAgentName)?.color}
              model={agents.find((a) => a.name === selectedAgentName)?.model}
              isActive
            />
          )}
        </div>
        <Select value={selectedAgentName} onValueChange={setSelectedAgentName}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Agent" />
          </SelectTrigger>
          <SelectContent>
            {agents
              .filter((a) => a.isActive)
              .map((agent) => (
                <SelectItem key={agent.id} value={agent.name}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    {agent.name}
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {currentChat?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isStreaming && (
            <StreamingMessage
              content={streamingContent}
              agentName={streamingAgentName}
              agentColor={streamingAgentColor}
            />
          )}
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        onFileSelect={handleFileSelect}
        isLoading={isLoading}
      />
    </div>
  );
}
