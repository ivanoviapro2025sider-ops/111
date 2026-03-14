import { create } from 'zustand';
import { ChatMessage, Chat } from '@/types/chat';

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  streamingAgentName: string | null;
  streamingAgentColor: string | null;

  setChats: (chats: Chat[]) => void;
  setCurrentChat: (chatId: string | null) => void;
  addChat: (chat: Chat) => void;
  removeChat: (chatId: string) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  setStreamingAgent: (name: string | null, color: string | null) => void;
  appendStreamingContent: (chunk: string) => void;
  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  createChat: () => Promise<string>;
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingAgentName: null,
  streamingAgentColor: null,

  setChats: (chats) => set({ chats }),
  setCurrentChat: (chatId) => set({ currentChatId: chatId }),
  addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats] })),
  removeChat: (chatId) => set((s) => ({ chats: s.chats.filter(c => c.id !== chatId) })),
  updateChat: (chatId, updates) => set((s) => ({
    chats: s.chats.map(c => c.id === chatId ? { ...c, ...updates } : c),
  })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessage: (messageId, updates) => set((s) => ({
    messages: s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  setStreamingAgent: (name, color) => set({ streamingAgentName: name, streamingAgentColor: color }),
  appendStreamingContent: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),

  fetchChats: async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        set({ chats: data });
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const res = await fetch(`/api/chat?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        set({ messages: data.messages || [], currentChatId: chatId });
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  },

  createChat: async (): Promise<string> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    });
    const chat = await res.json();
    get().addChat(chat);
    set({ currentChatId: chat.id, messages: [] });
    return chat.id;
  },

  sendMessage: async (content: string, attachments?: string[]) => {
    const state = get();
    let chatId = state.currentChatId;

    if (!chatId) {
      chatId = await state.createChat();
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments: attachments?.map(id => ({
        id,
        name: '',
        mimeType: '',
        size: 0,
        status: 'uploaded' as const,
      })),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isLoading: true,
      isStreaming: true,
      streamingContent: '',
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          message: content,
          attachments,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let agentName = '';
        let agentColor = '';
        let agentId = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'agent') {
                  agentName = parsed.name;
                  agentColor = parsed.color;
                  agentId = parsed.id;
                  set({ streamingAgentName: agentName, streamingAgentColor: agentColor });
                } else if (parsed.type === 'content') {
                  fullContent += parsed.content;
                  set({ streamingContent: fullContent });
                } else if (parsed.type === 'handoff') {
                  const handoffMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: fullContent || `Transferring to ${parsed.to}...`,
                    agentName,
                    agentColor,
                    agentId,
                    timestamp: new Date().toISOString(),
                    metadata: { handoffTo: parsed.to },
                  };
                  set((s) => ({ messages: [...s.messages, handoffMsg] }));
                  fullContent = '';
                  agentName = parsed.to;
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message);
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }

        if (fullContent) {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullContent,
            agentName,
            agentColor,
            agentId,
            timestamp: new Date().toISOString(),
          };
          set((s) => ({ messages: [...s.messages, assistantMessage] }));
        }
      } else {
        const data = await res.json();
        if (data.messages) {
          set((s) => ({ messages: [...s.messages, ...data.messages] }));
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errorMessage] }));
    } finally {
      set({ isLoading: false, isStreaming: false, streamingContent: '' });
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      await fetch(`/api/chat?chatId=${chatId}`, { method: 'DELETE' });
      set((s) => ({
        chats: s.chats.filter(c => c.id !== chatId),
        currentChatId: s.currentChatId === chatId ? null : s.currentChatId,
        messages: s.currentChatId === chatId ? [] : s.messages,
      }));
    } catch (e) {
      console.error('Failed to delete chat:', e);
    }
  },
}));
