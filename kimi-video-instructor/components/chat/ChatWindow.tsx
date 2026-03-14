'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Instruction } from '@/types/instruction';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ChatWindowProps {
  projectId: string;
  instruction: Instruction | null;
}

export function ChatWindow({ projectId, instruction }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettingsStore();

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/chat`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: ChatMessage[]) => setMessages(data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent('');
      setIsStreaming(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            message: message.trim(),
            apiKey: settings.openrouterApiKey || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to send message');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
                if (data.done) break;
              } catch {}
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `temp-assistant-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
      }
    },
    [projectId, isStreaming, settings.openrouterApiKey]
  );

  const handleApplyToStep = useCallback((_messageId: string, _content: string) => {
    // TODO: integrate with instruction editor
  }, []);

  const disabled = isStreaming;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : messages.length === 0 && !streamingContent ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Start a conversation about the instruction
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <MessageBubble
                    role={msg.role}
                    content={msg.content}
                    createdAt={msg.createdAt}
                  />
                  {msg.role === 'assistant' && (
                    <div className="flex justify-start pl-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyToStep(msg.id, msg.content)}
                      >
                        Apply to step
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && streamingContent && (
                <StreamingMessage content={streamingContent} isComplete={false} />
              )}
            </>
          )}
        </div>
        <div ref={scrollRef} />
      </ScrollArea>
      <div className="p-4 border-t">
        <ChatInput onSend={handleSend} disabled={disabled} />
      </div>
    </div>
  );
}
