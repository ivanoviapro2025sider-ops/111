"use client";

import { useEffect, useMemo } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useChatStore } from "@/stores/chatStore";

export function ChatWindow() {
  const {
    chats,
    activeChatId,
    loadChats,
    openChat,
    createChat,
    sendMessage,
    sending,
    debugEvents,
  } = useChatStore();

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  );

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
      <aside className="border-r border-zinc-800 p-4">
        <button
          type="button"
          onClick={() => void createChat()}
          className="mb-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + New chat
        </button>
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => void openChat(chat.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                activeChatId === chat.id
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300"
              }`}
            >
              <p className="truncate">{chat.title}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {!activeChat && (
            <p className="text-sm text-zinc-500">Create a new chat to begin.</p>
          )}
          {activeChat?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
        <div className="border-t border-zinc-800 p-4">
          <ChatInput onSend={async (value, attachments) => sendMessage(value, attachments)} />
          {sending && <p className="mt-2 text-xs text-zinc-500">Streaming response...</p>}
        </div>
      </main>

      <aside className="border-l border-zinc-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-200">Debug events</h3>
        <div className="space-y-2 text-xs text-zinc-400">
          {debugEvents.slice(-12).map((event, index) => (
            <pre key={`${event.type}-${index}`} className="rounded bg-zinc-900 p-2">
              {event.type}: {JSON.stringify(event.payload, null, 2)}
            </pre>
          ))}
          {!debugEvents.length && <p>No debug events yet.</p>}
        </div>
      </aside>
    </div>
  );
}
