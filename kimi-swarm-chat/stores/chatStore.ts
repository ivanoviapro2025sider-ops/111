"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";

interface ChatState {
  chatId: string | null;
  activeAgentId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  setChatId: (chatId: string | null) => void;
  setActiveAgentId: (agentId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateStreamingMessage: (content: string) => void;
  setStreaming: (value: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatId: null,
  activeAgentId: null,
  messages: [],
  isStreaming: false,
  setChatId: (chatId) => set({ chatId }),
  setActiveAgentId: (activeAgentId) => set({ activeAgentId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateStreamingMessage: (content) =>
    set((state) => {
      if (!state.messages.length) return state;
      const next = [...state.messages];
      const last = next[next.length - 1];
      if (last.role === "assistant" && last.isStreaming) {
        next[next.length - 1] = { ...last, content };
      }
      return { messages: next };
    }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  reset: () =>
    set({
      chatId: null,
      activeAgentId: null,
      messages: [],
      isStreaming: false,
    }),
}));
