'use client';

import { create } from 'zustand';
import type { Chat, ChatMessage, StreamChunk } from '@/types/chat';

interface ChatStore {
  chats: Chat[];
  currentChatId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingAgentName: string | null;
  streamingAgentColor: string | null;

  setChats: (chats: Chat[]) => void;
  setCurrentChat: (chatId: string | null) => void;
  addChat: (chat: Chat) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateLastMessage: (chatId: string, content: string) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (chunk: StreamChunk) => void;
  resetStream: () => void;
  getCurrentChat: () => Chat | undefined;
  fetchChats: () => Promise<void>;
  createChat: (agentName?: string) => Promise<Chat>;
  sendMessage: (message: string, agentName?: string, fileIds?: string[]) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  currentChatId: null,
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingAgentName: null,
  streamingAgentColor: null,

  setChats: (chats) => set({ chats }),
  setCurrentChat: (chatId) => set({ currentChatId: chatId }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  deleteChat: (chatId) =>
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
    })),
  addMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, message] } : c
      ),
    })),
  updateLastMessage: (chatId, content) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m, i) =>
                i === c.messages.length - 1 ? { ...m, content } : m
              ),
            }
          : c
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamContent: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent + (chunk.content || ''),
      streamingAgentName: chunk.agentName || state.streamingAgentName,
      streamingAgentColor: chunk.agentColor || state.streamingAgentColor,
    })),
  resetStream: () =>
    set({
      streamingContent: '',
      streamingAgentName: null,
      streamingAgentColor: null,
      isStreaming: false,
    }),

  getCurrentChat: () => {
    const { chats, currentChatId } = get();
    return chats.find((c) => c.id === currentChatId);
  },

  fetchChats: async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        set({ chats: data });
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  },

  createChat: async (agentName?: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName }),
    });
    const chat = await res.json();
    set((state) => ({
      chats: [chat, ...state.chats],
      currentChatId: chat.id,
    }));
    return chat;
  },

  sendMessage: async (message, agentName, fileIds) => {
    const state = get();
    let chatId = state.currentChatId;

    if (!chatId) {
      const chat = await state.createChat(agentName);
      chatId = chat.id;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    state.addMessage(chatId, userMessage);
    set({ isLoading: true, isStreaming: true, streamingContent: '' });

    try {
      const res = await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          message,
          agentName,
          fileIds,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let currentAgentName = agentName;
      let currentAgentColor = '';

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        agentName: currentAgentName,
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      state.addMessage(chatId!, assistantMessage);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const chunk: StreamChunk = JSON.parse(data);

            switch (chunk.type) {
              case 'content':
                fullContent += chunk.content || '';
                currentAgentName = chunk.agentName || currentAgentName;
                currentAgentColor = chunk.agentColor || currentAgentColor;
                set({
                  streamingContent: fullContent,
                  streamingAgentName: currentAgentName || null,
                  streamingAgentColor: currentAgentColor || null,
                });
                state.updateLastMessage(chatId!, fullContent);
                break;
              case 'handoff':
                currentAgentName = chunk.handoffTo;
                const handoffMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'system',
                  content: `Handoff: ${chunk.handoffFrom} → ${chunk.handoffTo}`,
                  timestamp: new Date().toISOString(),
                  metadata: { handoffFrom: chunk.handoffFrom, handoffTo: chunk.handoffTo },
                };
                state.addMessage(chatId!, handoffMsg);
                break;
              case 'error':
                state.updateLastMessage(chatId!, `Error: ${chunk.error}`);
                break;
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      set({ isLoading: false, isStreaming: false });
    }
  },
}));
