'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAgentStore } from '@/stores/agentStore';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { StreamingMessage } from './StreamingMessage';
import { AgentIndicator } from './AgentIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ChatWindow() {
  const {
    currentChatId,
    isStreaming,
    streamingContent,
    streamingAgent,
    streamingAgentColor,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setStreamingAgent,
    addMessage,
    addChat,
    setCurrentChat,
    getCurrentChat,
    isLoading,
    setLoading,
  } = useChatStore();

  const { agents, selectedAgentId, setSelectedAgent } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentChat = getCurrentChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChat?.messages, streamingContent]);

  const handleSend = useCallback(
    async (content: string, files?: File[]) => {
      let chatId = currentChatId;

      if (!chatId) {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: content.slice(0, 50) }),
          });
          const data = await res.json();
          if (data.chat) {
            addChat(data.chat);
            setCurrentChat(data.chat.id);
            chatId = data.chat.id;
          }
        } catch {
          return;
        }
      }

      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
      };
      addMessage(chatId!, userMessage);

      if (files && files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          try {
            await fetch('/api/files/upload', { method: 'POST', body: formData });
          } catch (e) {
            console.error('Upload failed:', e);
          }
        }
      }

      setLoading(true);
      setStreaming(true);
      resetStreamContent();

      try {
        const messages = currentChat
          ? [...currentChat.messages, userMessage].map((m) => ({ role: m.role, content: m.content }))
          : [{ role: 'user', content }];

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            agentId: selectedAgentId,
            chatId,
          }),
        });

        if (!response.ok) throw new Error('Chat request failed');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));
                  if (event.type === 'content') {
                    fullContent += event.data;
                    appendStreamContent(event.data);
                    if (event.agent) setStreamingAgent(event.agent, event.agentColor);
                  } else if (event.type === 'done') {
                    if (event.chatId && event.chatId !== chatId) {
                      setCurrentChat(event.chatId);
                    }
                  } else if (event.type === 'error') {
                    console.error('Stream error:', event.data);
                  }
                } catch {
                  // skip malformed events
                }
              }
            }
          }
        }

        if (fullContent) {
          addMessage(chatId!, {
            id: Date.now().toString(),
            role: 'assistant',
            content: fullContent,
            agent: streamingAgent || undefined,
            agentColor: streamingAgentColor || undefined,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Chat error:', error);
        addMessage(chatId!, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          timestamp: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
        setLoading(false);
        resetStreamContent();
      }
    },
    [currentChatId, currentChat, selectedAgentId, addMessage, addChat, setCurrentChat, setLoading, setStreaming, appendStreamContent, resetStreamContent, setStreamingAgent, streamingAgent, streamingAgentColor]
  );

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      const data = await res.json();
      if (data.chat) {
        addChat(data.chat);
        setCurrentChat(data.chat.id);
      }
    } catch (e) {
      console.error('Failed to create chat:', e);
    }
  };

  if (!currentChatId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">KIMI Swarm Chat</h2>
          <p className="text-muted-foreground max-w-md">
            Start a new conversation with AI agents powered by Kimi K2 via OpenRouter.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          {agents.length > 0 && (
            <Select value={selectedAgentId || ''} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter((a) => a.isActive).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: agent.color }} />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleNewChat} className="gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>
    );
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          {selectedAgent && (
            <AgentIndicator
              name={selectedAgent.name}
              color={selectedAgent.color}
              model={selectedAgent.model}
              isActive={isStreaming}
            />
          )}
          {!selectedAgent && agents.length > 0 && (
            <Select value={selectedAgentId || ''} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter((a) => a.isActive).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {currentChat?.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingContent && (
            <StreamingMessage
              content={streamingContent}
              agentName={streamingAgent || undefined}
              agentColor={streamingAgentColor || undefined}
            />
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={handleSend} isLoading={isLoading || isStreaming} />
      </div>
    </div>
  );
}
