import { create } from 'zustand';
import { Chat, ChatMessage } from '@/types/chat';

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingAgent: string | null;
  streamingAgentColor: string | null;

  setChats: (chats: Chat[]) => void;
  setCurrentChat: (chatId: string | null) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (content: string) => void;
  resetStreamContent: () => void;
  setStreamingAgent: (name: string | null, color: string | null) => void;
  getCurrentChat: () => Chat | undefined;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingAgent: null,
  streamingAgentColor: null,

  setChats: (chats) => set({ chats }),
  setCurrentChat: (chatId) => set({ currentChatId: chatId }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, ...updates } : c)),
    })),
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
  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
            }
          : c
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  resetStreamContent: () => set({ streamingContent: '', streamingAgent: null, streamingAgentColor: null }),
  setStreamingAgent: (name, color) => set({ streamingAgent: name, streamingAgentColor: color }),
  getCurrentChat: () => {
    const { chats, currentChatId } = get();
    return chats.find((c) => c.id === currentChatId);
  },
}));
