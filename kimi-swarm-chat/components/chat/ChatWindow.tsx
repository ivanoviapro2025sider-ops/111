"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AgentIndicator } from "@/components/chat/AgentIndicator";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChatStore } from "@/stores/chatStore";
import type { ChatMessage } from "@/types/chat";

interface AgentLite {
  id: string;
  name: string;
  color: string;
  model: string;
}

interface ChatLite {
  id: string;
  title: string;
  messages: ChatMessage[];
}

const CHUNK_SIZE = 5 * 1024 * 1024;

async function uploadFileInChunks(file: File) {
  const uploadId = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  let uploaded: Record<string, unknown> | null = null;
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("fileName", file.name);
    formData.append("mimeType", file.type || "application/octet-stream");
    formData.append("totalSize", String(file.size));
    formData.append("totalChunks", String(totalChunks));
    formData.append("chunkIndex", String(chunkIndex));
    formData.append("chunk", chunk);

    const response = await fetch("/api/files/upload", { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`Chunk upload failed for ${file.name}`);
    }
    uploaded = await response.json();
  }

  return uploaded?.file ?? null;
}

function parseSSEPayload(buffer: string) {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() || "";

  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "message";
    let data = "{}";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      events.push({ event, data: { raw: data } });
    }
  }

  return { events, remainder };
}

export function ChatWindow() {
  const {
    messages,
    setMessages,
    addMessage,
    updateStreamingMessage,
    chatId,
    setChatId,
    activeAgentId,
    setActiveAgentId,
    isStreaming,
    setStreaming,
  } = useChatStore();

  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [chats, setChats] = useState<ChatLite[]>([]);
  const [agentView, setAgentView] = useState<AgentLite | null>(null);
  const [debugEvents, setDebugEvents] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void (async () => {
      const [agentsRes, chatsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/chats"),
      ]);
      const agentPayload = (await agentsRes.json()) as AgentLite[];
      const chatPayload = (await chatsRes.json()) as ChatLite[];
      setAgents(agentPayload);
      setChats(chatPayload);
      if (!activeAgentId && agentPayload[0]) {
        setActiveAgentId(agentPayload[0].id);
      }
    })();
  }, [activeAgentId, setActiveAgentId]);

  const currentAgent = useMemo(
    () => agentView || agents.find((agent) => agent.id === activeAgentId) || null,
    [agentView, agents, activeAgentId],
  );

  const exportChat = (format: "json" | "txt" | "md") => {
    let content = "";
    if (format === "json") {
      content = JSON.stringify(messages, null, 2);
    } else if (format === "md") {
      content = messages
        .map((m) => `### ${m.role.toUpperCase()}\n\n${m.content}`)
        .join("\n\n");
    } else {
      content = messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n");
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export.${format === "json" ? "json" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendMessage = async (content: string, files: File[]) => {
    setStreaming(true);
    setDebugEvents([]);

    const uploadedAttachments = [];
    for (const file of files) {
      const uploaded = await uploadFileInChunks(file);
      if (uploaded) uploadedAttachments.push(uploaded);
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      attachments: uploadedAttachments as never,
    });
    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    });

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message: content,
        agentId: activeAgentId ?? undefined,
        attachments: uploadedAttachments,
        debug: true,
      }),
    });

    if (!response.body || !response.ok) {
      updateStreamingMessage("Ошибка запроса к /api/chat.");
      setStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let composed = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSSEPayload(buffer);
      buffer = parsed.remainder;

      for (const entry of parsed.events) {
        setDebugEvents((current) => [...current, { type: entry.event, ...entry.data }]);
        if (entry.event === "token") {
          const token = String(entry.data.token ?? "");
          composed += token;
          updateStreamingMessage(composed);
        }
        if (entry.event === "agent_start") {
          const agent = entry.data.agent as AgentLite | undefined;
          if (agent) setAgentView(agent);
        }
        if (entry.event === "done") {
          composed = String(entry.data.content ?? composed);
          updateStreamingMessage(composed);
        }
        if (entry.event === "final") {
          const finalChatId = String(entry.data.chatId ?? "");
          if (finalChatId) setChatId(finalChatId);
        }
      }
    }

    setMessages(
      useChatStore
        .getState()
        .messages.map((message) =>
          message.isStreaming ? { ...message, isStreaming: false } : message,
        ),
    );
    setStreaming(false);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
      <Card className="hidden overflow-y-auto lg:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Chats</h2>
          <Button size="sm" onClick={() => useChatStore.getState().reset()}>
            New
          </Button>
        </div>
        <div className="space-y-1">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className="block w-full rounded-md px-2 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                setChatId(chat.id);
                setMessages(chat.messages);
              }}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </Card>

      <section className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <AgentIndicator
            name={currentAgent?.name}
            color={currentAgent?.color}
            model={currentAgent?.model}
          />
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => exportChat("json")}>
              <Download className="mr-1 h-4 w-4" />
              JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportChat("md")}>
              <Download className="mr-1 h-4 w-4" />
              MD
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportChat("txt")}>
              <Download className="mr-1 h-4 w-4" />
              TXT
            </Button>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
        <div className="border-t border-zinc-800 p-4">
          <ChatInput disabled={isStreaming} onSend={sendMessage} />
        </div>
      </section>

      <Card className="hidden overflow-y-auto lg:block">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Debug / Agent Info</h3>
        {currentAgent ? (
          <div className="mb-4 space-y-1 text-xs text-zinc-300">
            <p>Active: {currentAgent.name}</p>
            <p>Model: {currentAgent.model}</p>
            <p className="flex items-center gap-2">
              Color
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: currentAgent.color }}
              />
            </p>
          </div>
        ) : (
          <p className="mb-4 text-xs text-zinc-500">No active agent.</p>
        )}
        <div className="space-y-2">
          {debugEvents.slice(-15).map((event, index) => (
            <pre
              key={`event-${index}`}
              className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-2 text-[11px] text-zinc-400"
            >
              {JSON.stringify(event, null, 2)}
            </pre>
          ))}
        </div>
      </Card>
    </div>
  );
}
