"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { AgentIndicator } from "@/components/chat/AgentIndicator";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";
import type { FileAttachment } from "@/types/file";
import { useAgentStore } from "@/stores/agentStore";
import { useChatStore } from "@/stores/chatStore";

interface ChatListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export default function ChatPage() {
  const {
    messages,
    setMessages,
    appendMessage,
    setStreaming,
    isStreaming,
    setChatId,
    chatId,
    activeAgentColor,
    activeAgentName,
    setActiveAgent,
  } = useChatStore();
  const { agents, setAgents, selectedAgentId, setSelectedAgent } = useAgentStore();

  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/chat")
        .then((r) => r.json())
        .then((payload: { data: ChatListItem[] }) => setChatList(payload.data || [])),
      fetch("/api/agents")
        .then((r) => r.json())
        .then((payload: { data: Agent[] }) => {
          setAgents(payload.data || []);
          if (payload.data?.[0]) {
            setSelectedAgent(payload.data[0].id);
            setActiveAgent(payload.data[0].name, payload.data[0].color);
          }
        }),
      fetch("/api/files")
        .then((r) => r.json())
        .then((payload: { data: FileAttachment[] }) => setFiles(payload.data || [])),
    ]);
  }, [setActiveAgent, setAgents, setSelectedAgent]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || agents[0] || null,
    [agents, selectedAgentId],
  );

  async function openChat(id: string) {
    const response = await fetch(`/api/chat?chatId=${id}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { data: { messages: ChatMessage[] } };
    setChatId(id);
    setMessages(payload.data.messages || []);
  }

  async function sendMessage(text: string) {
    if (!selectedAgent) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    appendMessage(userMessage);
    setStreaming(true);
    setStreamingMessage({
      id: uuidv4(),
      role: "assistant",
      content: "",
      agent: selectedAgent.name,
      agentColor: selectedAgent.color,
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message: text,
        agentId: selectedAgent.id,
        fileIds: selectedFileIds,
      }),
    });

    if (!response.ok || !response.body) {
      setStreaming(false);
      setStreamingMessage(null);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";
    let nextChatId = chatId;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const eventMatch = chunk.match(/^event:\s*(.+)$/m);
        const dataMatch = chunk.match(/^data:\s*(.+)$/m);
        if (!eventMatch || !dataMatch) continue;
        const event = eventMatch[1];
        const payload = JSON.parse(dataMatch[1]) as Record<string, unknown>;

        if (event === "meta" && typeof payload.chatId === "string") {
          nextChatId = payload.chatId;
          setChatId(payload.chatId);
        }
        if (event === "agent") {
          setActiveAgent(String(payload.name || "Agent"), String(payload.color || "#6366f1"));
        }
        if (event === "token") {
          assistantText += String(payload.token || "");
          setStreamingMessage((prev) =>
            prev
              ? {
                  ...prev,
                  content: assistantText,
                }
              : null,
          );
        }
      }
    }

    setStreaming(false);
    if (assistantText.trim()) {
      appendMessage({
        id: uuidv4(),
        role: "assistant",
        content: assistantText,
        timestamp: new Date().toISOString(),
        agent: selectedAgent.name,
        agentColor: selectedAgent.color,
      });
    }
    setStreamingMessage(null);

    if (!chatId && nextChatId) {
      const refreshed = await fetch("/api/chat").then((r) => r.json());
      setChatList((refreshed as { data: ChatListItem[] }).data || []);
    }
  }

  async function attachFiles(selected: File[]) {
    for (const file of selected) {
      const form = new FormData();
      form.set("chunk", file);
      form.set("uploadId", uuidv4());
      form.set("fileName", file.name);
      form.set("mimeType", file.type || "application/octet-stream");
      form.set("totalChunks", "1");
      form.set("chunkIndex", "0");
      form.set("size", String(file.size));
      form.set("finalize", "true");
      const response = await fetch("/api/files/upload", { method: "POST", body: form });
      if (response.ok) {
        const payload = (await response.json()) as { file: FileAttachment };
        setFiles((prev) => [payload.file, ...prev]);
        setSelectedFileIds((prev) => [...prev, payload.file.id]);
      }
    }
  }

  return (
    <div className="grid h-[calc(100vh-110px)] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <section className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 p-3">
          <Button
            className="w-full"
            onClick={() => {
              setMessages([]);
              setChatId("");
            }}
          >
            + Новый чат
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {chatList.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => void openChat(chat.id)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 p-2 text-left hover:border-zinc-700"
            >
              <p className="truncate text-sm text-zinc-100">{chat.title}</p>
              <p className="truncate text-xs text-zinc-500">{chat.preview}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <AgentIndicator name={activeAgentName} color={activeAgentColor} />
          <div className="flex items-center gap-2">
            <Badge>{selectedAgent?.model || "—"}</Badge>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              value={selectedAgent?.id || ""}
              onChange={(e) => {
                setSelectedAgent(e.target.value);
                const found = agents.find((agent) => agent.id === e.target.value);
                if (found) setActiveAgent(found.name, found.color);
              }}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ChatWindow messages={messages} streamingMessage={streamingMessage} />
        </div>
        <ChatInput
          disabled={isStreaming}
          attachments={files.filter((file) => selectedFileIds.includes(file.id))}
          onAttach={attachFiles}
          onSend={(text) => {
            void sendMessage(text);
          }}
        />
      </section>

      <section className="min-h-0 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <h3 className="text-sm font-semibold text-zinc-100">Agent / Files</h3>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
          <p>Active agent: {selectedAgent?.name || "—"}</p>
          <p>Temperature: {selectedAgent?.sampling.temperature ?? "—"}</p>
          <p>Max tokens: {selectedAgent?.sampling.max_tokens ?? "—"}</p>
        </div>
        <div className="space-y-2 overflow-y-auto">
          {files.map((file) => {
            const selected = selectedFileIds.includes(file.id);
            return (
              <label
                key={file.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-xs text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFileIds((prev) => [...prev, file.id]);
                    } else {
                      setSelectedFileIds((prev) => prev.filter((id) => id !== file.id));
                    }
                  }}
                />
                <span>{file.name}</span>
                <span className="ml-auto text-zinc-500">{file.status}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
