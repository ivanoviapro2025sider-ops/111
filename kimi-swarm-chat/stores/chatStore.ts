"use client";

import { create } from "zustand";
import type { ChatMessage, ChatSession } from "@/types/chat";

interface ChatState {
  sessions: ChatSession[];
  activeChatId?: string;
  loading: boolean;
  streaming: boolean;
  error?: string;
  fetchChats: () => Promise<void>;
  setActiveChat: (chatId: string) => void;
  createLocalChat: () => void;
  sendMessage: (payload: {
    message: string;
    agentId?: string;
    attachments?: string[];
    stream?: boolean;
  }) => Promise<void>;
}

function normalizeChat(raw: Record<string, unknown>): ChatSession {
  return {
    id: String(raw.id),
    title: String(raw.title),
    createdAt: new Date(String(raw.createdAt)).toISOString(),
    updatedAt: new Date(String(raw.updatedAt)).toISOString(),
    activeAgentId: (raw.activeAgentId as string | undefined) ?? undefined,
    activeAgent: raw.agent
      ? {
          ...(raw.agent as Record<string, unknown>),
          createdAt: new Date(
            String((raw.agent as Record<string, unknown>).createdAt),
          ).toISOString(),
          updatedAt: new Date(
            String((raw.agent as Record<string, unknown>).updatedAt),
          ).toISOString(),
        } as ChatSession["activeAgent"]
      : undefined,
    messages: ((raw.messages as Array<Record<string, unknown>> | undefined) ?? []).map(
      (message) => ({
        id: String(message.id),
        role: message.role as "user" | "assistant" | "system" | "tool",
        content: String(message.content ?? ""),
        agent: (message.agent as string | undefined) ?? undefined,
        agentColor: (message.agentColor as string | undefined) ?? undefined,
        timestamp: new Date(String(message.createdAt)).toISOString(),
        attachments: (message.attachments as ChatMessage["attachments"]) ?? undefined,
        toolCalls: (message.toolCalls as ChatMessage["toolCalls"]) ?? undefined,
        metadata: (message.metadata as ChatMessage["metadata"]) ?? undefined,
        isStreaming: false,
      }),
    ),
  };
}

function normalizeChats(raw: unknown): ChatSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((chat) => normalizeChat(chat as Record<string, unknown>));
}

function withMessage(
  sessions: ChatSession[],
  chatId: string,
  message: ChatMessage,
): ChatSession[] {
  return sessions.map((session) =>
    session.id === chatId ? { ...session, messages: [...session.messages, message] } : session,
  );
}

function updateMessage(
  sessions: ChatSession[],
  chatId: string,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatSession[] {
  return sessions.map((session) =>
    session.id === chatId
      ? {
          ...session,
          messages: session.messages.map((message) =>
            message.id === messageId ? updater(message) : message,
          ),
        }
      : session,
  );
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeChatId: undefined,
  loading: false,
  streaming: false,
  error: undefined,
  fetchChats: async () => {
    set({ loading: true, error: undefined });
    try {
      const response = await fetch("/api/chats", { cache: "no-store" });
      const data = await response.json();
      const sessions = normalizeChats(data);
      set((state) => ({
        sessions,
        activeChatId: state.activeChatId ?? sessions[0]?.id,
        loading: false,
      }));
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load chats",
      });
    }
  },
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  createLocalChat: () => {
    const id = `temp-${crypto.randomUUID()}`;
    set((state) => ({
      activeChatId: id,
      sessions: [
        {
          id,
          title: "New chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        },
        ...state.sessions,
      ],
    }));
  },
  sendMessage: async ({ message, agentId, attachments, stream = true }) => {
    const state = get();
    const activeChatId = state.activeChatId;
    if (!activeChatId || !message.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      attachments: attachments?.map((id) => ({
        id,
        fileName: id,
        mimeType: "",
        size: 0,
      })),
    };

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    set((prev) => ({
      sessions: withMessage(withMessage(prev.sessions, activeChatId, userMessage), activeChatId, assistantMessage),
      streaming: true,
      error: undefined,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId.startsWith("temp-") ? undefined : activeChatId,
          message,
          agentId,
          attachments,
          stream,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const data = await response.json();
        set((prev) => ({
          sessions: updateMessage(prev.sessions, activeChatId, assistantMessageId, (existing) => ({
            ...existing,
            content: data.message?.content ?? "",
            isStreaming: false,
          })),
          streaming: false,
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing response stream.");

      const decoder = new TextDecoder();
      let buffer = "";
      let resultingChatId = activeChatId;

      // Lightweight SSE parser to handle streaming tokens.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventChunk of events) {
          const lines = eventChunk.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.replace("event:", "").trim();
            if (line.startsWith("data:")) dataLine = line.replace("data:", "").trim();
          }
          if (!dataLine) continue;

          const data = JSON.parse(dataLine) as Record<string, unknown>;

          if (eventName === "agent") {
            resultingChatId = String(data.chatId ?? resultingChatId);
          } else if (eventName === "handoff") {
            set((prev) => ({
              sessions: updateMessage(prev.sessions, activeChatId, assistantMessageId, (existing) => ({
                ...existing,
                metadata: {
                  ...(existing.metadata ?? {}),
                  handoffFrom: String(data.from ?? ""),
                  handoffTo: String(data.to ?? ""),
                },
              })),
            }));
          } else if (data.type === "token") {
            set((prev) => ({
              sessions: updateMessage(prev.sessions, activeChatId, assistantMessageId, (existing) => ({
                ...existing,
                content: existing.content + String(data.content ?? ""),
              })),
            }));
          } else if (data.type === "done") {
            resultingChatId = String(data.chatId ?? resultingChatId);
          } else if (data.type === "error") {
            throw new Error(String(data.message ?? "Streaming error"));
          }
        }
      }

      await get().fetchChats();
      set((prev) => ({
        activeChatId: resultingChatId.startsWith("temp-")
          ? prev.sessions[0]?.id
          : resultingChatId,
      }));
    } catch (error) {
      set((prev) => ({
        sessions: updateMessage(prev.sessions, activeChatId, assistantMessageId, (existing) => ({
          ...existing,
          isStreaming: false,
          content:
            existing.content ||
            "Ошибка при получении ответа модели. Проверьте API-ключ и параметры OpenRouter.",
        })),
        streaming: false,
        error: error instanceof Error ? error.message : "Chat send failed",
      }));
      return;
    }

    set((prev) => ({
      sessions: updateMessage(prev.sessions, activeChatId, assistantMessageId, (existing) => ({
        ...existing,
        isStreaming: false,
      })),
      streaming: false,
    }));
  },
}));
