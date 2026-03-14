'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAgentStore } from '@/stores/agentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import MessageBubble from './MessageBubble';
import StreamingMessage from './StreamingMessage';
import ChatInput from './ChatInput';
import AgentIndicator from './AgentIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChunkedUploader } from '@/lib/chunked-upload';

export default function ChatWindow() {
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingAgentName,
    streamingAgentColor,
    currentChatId,
    sendMessage,
    fetchMessages,
    createChat,
    isLoading,
  } = useChatStore();

  const { agents, currentAgentId, fetchAgents } = useAgentStore();
  const { showDebug } = useSettingsStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; name: string; size: number }>>([]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
    }
  }, [currentChatId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = useCallback(
    async (content: string, attachments?: string[]) => {
      await sendMessage(content, attachments);
      setPendingFiles([]);
    },
    [sendMessage]
  );

  const handleFileSelect = useCallback(async (files: FileList) => {
    const uploader = new ChunkedUploader();
    for (const file of Array.from(files)) {
      try {
        const result = await uploader.upload(file);
        setPendingFiles((prev) => [...prev, { id: result.id, name: file.name, size: file.size }]);

        await fetch('/api/files/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: result.id }),
        });
      } catch (e) {
        console.error('File upload failed:', e);
      }
    }
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const currentAgent = agents.find((a) => a.id === currentAgentId);

  if (!currentChatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">KIMI Swarm Chat</h2>
          <p className="text-muted-foreground max-w-md">
            Start a new conversation with AI agents powered by Kimi K2 via OpenRouter.
            {agents.length > 0 && ` ${agents.length} agent(s) available.`}
          </p>
        </div>
        <Button onClick={createChat} className="gap-2">
          <MessageSquarePlus className="w-4 h-4" />
          Start New Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {currentAgent && (
        <AgentIndicator
          agentName={currentAgent.name}
          agentColor={currentAgent.color}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bot className="w-10 h-10 mb-4 opacity-30" />
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} showDebug={showDebug} />
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

      <div className="max-w-4xl mx-auto w-full">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          onFileSelect={handleFileSelect}
          pendingFiles={pendingFiles}
          onRemoveFile={handleRemoveFile}
        />
      </div>
    </div>
  );
}
