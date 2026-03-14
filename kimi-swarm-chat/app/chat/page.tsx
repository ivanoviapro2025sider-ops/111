"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatInput } from "@/components/chat/ChatInput";
import { AgentIndicator } from "@/components/chat/AgentIndicator";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import type { FileRecord } from "@/types/file";

export default function ChatPage() {
  const {
    sessions,
    activeChatId,
    fetchChats,
    setActiveChat,
    createLocalChat,
    sendMessage,
    streaming,
    error,
  } = useChatStore();
  const { agents, fetchAgents } = useAgentStore();
  const [files, setFiles] = useState<FileRecord[]>([]);

  useEffect(() => {
    void fetchChats();
    void fetchAgents();
    void (async () => {
      const response = await fetch("/api/files", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setFiles(
          data.map((item: any) => ({
            ...item,
            size: Number(item.size),
            uploadedAt: new Date(item.uploadedAt).toISOString(),
            updatedAt: new Date(item.updatedAt).toISOString(),
          })),
        );
      }
    })();
  }, [fetchChats, fetchAgents]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeChatId),
    [sessions, activeChatId],
  );
  const activeAgent = useMemo(() => {
    if (activeSession?.activeAgentId) {
      return agents.find((agent) => agent.id === activeSession.activeAgentId);
    }
    return agents[0];
  }, [activeSession?.activeAgentId, agents]);

  return (
    <main className="flex h-screen flex-col">
      <Header title="Chat" />
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_320px] gap-4 p-4">
        <aside className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <Button className="w-full" onClick={createLocalChat}>
            + Новый чат
          </Button>
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveChat(session.id)}
                className={`w-full rounded-md px-2 py-2 text-left text-xs ${
                  session.id === activeChatId
                    ? "bg-indigo-500/30 text-zinc-100"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <p className="truncate font-medium">{session.title}</p>
                <p className="truncate text-[11px] text-zinc-500">
                  {new Date(session.updatedAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-3">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
            <AgentIndicator
              name={activeAgent?.name ?? "No active agent"}
              color={activeAgent?.color}
              avatar={activeAgent?.avatar}
            />
            {streaming && <p className="text-xs text-emerald-400">Streaming...</p>}
          </div>
          <ChatWindow session={activeSession} />
          <ChatInput
            disabled={streaming}
            onSend={async (message) => {
              await sendMessage({
                message,
                agentId: activeAgent?.id,
                stream: true,
              });
            }}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </section>

        <aside className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <h3 className="text-sm font-semibold text-zinc-100">Agent settings</h3>
          {activeAgent ? (
            <div className="space-y-2 text-xs text-zinc-300">
              <p>Model: {activeAgent.model}</p>
              <p>Temp: {activeAgent.sampling.temperature}</p>
              <p>Top P: {activeAgent.sampling.top_p}</p>
              <p>Max tokens: {activeAgent.sampling.max_tokens}</p>
              <p className="text-zinc-500">{activeAgent.description}</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No configured agents.</p>
          )}
          <div>
            <h4 className="mb-2 text-xs font-medium text-zinc-200">Files</h4>
            <div className="space-y-2">
              {files.slice(0, 8).map((file) => (
                <div key={file.id} className="rounded-md border border-zinc-800 p-2 text-xs">
                  <p className="truncate text-zinc-200">{file.originalName}</p>
                  <p className="text-zinc-500">{file.status}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
