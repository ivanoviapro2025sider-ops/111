"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { ChatMessage, ChatSession } from "@/types/chat";

interface ChatState {
  chats: ChatSession[];
  activeChatId: string | null;
  activeAgentId: string | null;
  loading: boolean;
  sending: boolean;
  debugEvents: Array<{ type: string; payload: unknown }>;
  loadChats: () => Promise<void>;
  createChat: () => Promise<string | null>;
  openChat: (chatId: string) => Promise<void>;
  setActiveAgent: (agentId: string | null) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
}

function parseSseChunk(chunk: string) {
  const events: Array<{ event: string; data: unknown }> = [];
  const parts = chunk.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLine = lines.find((line) => line.startsWith("data:"));
    if (!eventLine || !dataLine) continue;

    const event = eventLine.replace("event:", "").trim();
    const dataText = dataLine.replace("data:", "").trim();
    let data: unknown = dataText;
    try {
      data = JSON.parse(dataText);
    } catch {
      // Keep the raw string if JSON parse fails.
    }
    events.push({ event, data });
  }

  return { events, rest };
}

function normalizeChat(raw: unknown): ChatSession {
  const chat = raw as {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages?: Array<Record<string, unknown>>;
  };

  const messages: ChatMessage[] = (chat.messages ?? []).map((message) => ({
    id: String(message.id),
    role: message.role as ChatMessage["role"],
    content: String(message.content ?? ""),
    agent: message.agent ? String(message.agent) : undefined,
    agentColor: message.agentColor ? String(message.agentColor) : undefined,
    timestamp: String(message.createdAt ?? message.timestamp ?? new Date().toISOString()),
    metadata: (message.metadata as ChatMessage["metadata"]) ?? undefined,
  }));

  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  activeAgentId: null,
  loading: false,
  sending: false,
  debugEvents: [],

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  appendMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, message], updatedAt: new Date().toISOString() }
          : chat,
      ),
    })),

  loadChats: async () => {
    set({ loading: true });
    try {
      const response = await fetch("/api/chats");
      const chats = ((await response.json()) as unknown[]).map(normalizeChat);
      set({
        chats,
        activeChatId: chats[0]?.id ?? null,
      });
    } finally {
      set({ loading: false });
    }
  },

  createChat: async () => {
    const response = await fetch("/api/chats", { method: "POST" });
    if (!response.ok) return null;
    const chat = (await response.json()) as ChatSession;

    set((state) => ({
      chats: [{ ...chat, messages: [] }, ...state.chats],
      activeChatId: chat.id,
    }));
    return chat.id;
  },

  openChat: async (chatId) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (!response.ok) return;
      const chat = normalizeChat(await response.json());
      set((state) => ({
        activeChatId: chatId,
        chats: state.chats.some((existing) => existing.id === chatId)
          ? state.chats.map((existing) => (existing.id === chatId ? chat : existing))
          : [chat, ...state.chats],
      }));
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (content, attachments = []) => {
    const { activeChatId, chats, activeAgentId } = get();
    if (!activeChatId || !content.trim()) return;

    const currentChat = chats.find((chat) => chat.id === activeChatId);
    if (!currentChat) return;

    set({ sending: true });

    const userMessage: ChatMessage = {
      id: uuid(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    const assistantMessageId = uuid();
    const streamingMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    get().appendMessage(activeChatId, userMessage);
    get().appendMessage(activeChatId, streamingMessage);

    const outgoing = [...currentChat.messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId,
          agentId: activeAgentId ?? undefined,
          stream: true,
          messages: outgoing,
          attachments,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        const events = parsed.events;

        for (const parsedEvent of events) {
          if (parsedEvent.event === "token") {
            set((state) => ({
              chats: state.chats.map((chat) =>
                chat.id !== activeChatId
                  ? chat
                  : {
                      ...chat,
                      messages: chat.messages.map((message) =>
                        message.id === assistantMessageId
                          ? {
                              ...message,
                              content: `${message.content}${String(parsedEvent.data ?? "")}`,
                            }
                          : message,
                      ),
                    },
              ),
            }));
          }

          if (parsedEvent.event === "handoff" || parsedEvent.event === "debug") {
            set((state) => ({
              debugEvents: [
                ...state.debugEvents,
                { type: parsedEvent.event, payload: parsedEvent.data },
              ],
            }));
          }

          if (parsedEvent.event === "done") {
            set((state) => ({
              chats: state.chats.map((chat) =>
                chat.id !== activeChatId
                  ? chat
                  : {
                      ...chat,
                      messages: chat.messages.map((message) =>
                        message.id === assistantMessageId
                          ? { ...message, isStreaming: false }
                          : message,
                      ),
                    },
              ),
            }));
          }
        }

        buffer = parsed.rest;
      }
    } catch (error) {
      set((state) => ({
        debugEvents: [
          ...state.debugEvents,
          {
            type: "error",
            payload: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      }));
    } finally {
      set({ sending: false });
    }
  },
}));
