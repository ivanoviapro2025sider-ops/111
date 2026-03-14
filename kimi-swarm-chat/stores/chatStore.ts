"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";

interface ChatStoreState {
  chatId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  activeAgentName: string;
  activeAgentColor: string;
  setChatId: (chatId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  updateLastMessage: (patch: Partial<ChatMessage>) => void;
  setStreaming: (value: boolean) => void;
  setActiveAgent: (name: string, color: string) => void;
  reset: () => void;
}

const defaultAgentName = "KIMI Agent";
const defaultAgentColor = "#6366f1";

export const useChatStore = create<ChatStoreState>((set) => ({
  chatId: null,
  messages: [],
  isStreaming: false,
  activeAgentName: defaultAgentName,
  activeAgentColor: defaultAgentColor,
  setChatId: (chatId) => set({ chatId }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateLastMessage: (patch) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const clone = [...state.messages];
      const last = clone[clone.length - 1];
      clone[clone.length - 1] = { ...last, ...patch };
      return { messages: clone };
    }),
  setStreaming: (value) => set({ isStreaming: value }),
  setActiveAgent: (name, color) => set({ activeAgentName: name, activeAgentColor: color }),
  reset: () =>
    set({
      chatId: null,
      messages: [],
      isStreaming: false,
      activeAgentName: defaultAgentName,
      activeAgentColor: defaultAgentColor,
    }),
}));
