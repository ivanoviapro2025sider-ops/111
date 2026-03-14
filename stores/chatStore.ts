'use client';

import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '@/types/chat';

interface SendPayload {
  content: string;
  agentId?: string | null;
  sessionId?: string | null;
  attachments?: Array<{ id: string; name: string; size: number; type: string }>;
  debug?: boolean;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  openSession: (sessionId: string | null) => Promise<void>;
  sendMessage: (payload: SendPayload) => Promise<void>;
}

function upsertMessage(list: ChatMessage[], message: ChatMessage) {
  const index = list.findIndex((item) => item.id === message.id);
  if (index === -1) return [...list, message];
  const clone = [...list];
  clone[index] = { ...clone[index], ...message };
  return clone;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  loadSessions: async () => {
    const response = await fetch('/api/chat', { cache: 'no-store' });
    const data = await response.json();
    set({ sessions: data.sessions ?? [] });
  },
  openSession: async (sessionId) => {
    if (!sessionId) {
      set({ currentSessionId: null, messages: [] });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/chat?sessionId=${sessionId}`, { cache: 'no-store' });
      const data = await response.json();
      set({ currentSessionId: sessionId, messages: data.messages ?? [], isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load chat', isLoading: false });
    }
  },
  sendMessage: async (payload) => {
    set({ isStreaming: true, error: null });
    const localUserMessage: ChatMessage = { id: `local-user-${Date.now()}`, role: 'user', content: payload.content, timestamp: new Date().toISOString(), attachments: payload.attachments };
    set((state) => ({ messages: [...state.messages, localUserMessage] }));
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok || !response.body) {
      set({ isStreaming: false, error: `Chat request failed (${response.status})` });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const applyEvent = (eventName: string, data: string) => {
      const parsed = data ? JSON.parse(data) : {};
      if (eventName === 'session') {
        set({ currentSessionId: parsed.sessionId });
        void get().loadSessions();
      }
      if (eventName === 'message') {
        set((state) => ({ messages: upsertMessage(state.messages, parsed.message) }));
      }
      if (eventName === 'done') {
        set({ isStreaming: false });
        void get().loadSessions();
      }
      if (eventName === 'error') {
        set({ isStreaming: false, error: parsed.message ?? 'Streaming error' });
      }
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const lines = block.split('\n');
        const eventLine = lines.find((line) => line.startsWith('event:'));
        const dataLine = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
        if (eventLine) applyEvent(eventLine.slice(6).trim(), dataLine);
      }
    }
    set({ isStreaming: false });
  },
}));
