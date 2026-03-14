'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { AgentIndicator } from '@/components/chat/AgentIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useChatStore } from '@/stores/chatStore';
import { useAgentStore } from '@/stores/agentStore';

export function ChatWindow() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { sessions, currentSessionId, messages, isStreaming, loadSessions, openSession, sendMessage } = useChatStore();
  const { agents, loadAgents } = useAgentStore();

  useEffect(() => { void Promise.all([loadSessions(), loadAgents()]); }, [loadSessions, loadAgents]);

  const activeAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0], [agents, selectedAgentId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[280px,1fr,320px]">
      <Card className="flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/35">Chats</div>
            <div className="text-lg font-medium text-white">История</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void openSession(null)}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-2">
            {sessions.map((session) => (
              <button key={session.id} onClick={() => void openSession(session.id)} className={`rounded-2xl border px-3 py-3 text-left transition ${currentSessionId === session.id ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
                <div className="truncate text-sm font-medium text-white">{session.title}</div>
                <div className="mt-1 text-xs text-white/35">{new Date(session.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-4">
        <AgentIndicator name={activeAgent?.name} color={activeAgent?.color} model={activeAgent?.model} />
        <Card className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} />) : <div className="flex h-full items-center justify-center text-center text-sm text-white/45">Начните новый диалог, прикрепите файлы и направьте задачу в swarm-оркестр.</div>}
            </div>
            <div className="border-t border-white/10 p-4">
              <ChatInput disabled={isStreaming} onSubmit={async ({ content, attachments }) => { await sendMessage({ content, attachments, sessionId: currentSessionId, agentId: activeAgent?.id, debug: activeAgent?.debug }); }} />
            </div>
          </div>
        </Card>
      </div>
      <Card className="min-h-[calc(100vh-9rem)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/35">Agent settings</div>
            <div className="text-lg font-medium text-white">Текущий агент</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `chat-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm text-white/70">Active agent
            <select className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white" value={activeAgent?.id ?? ''} onChange={(event) => setSelectedAgentId(event.target.value)}>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
          {activeAgent ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70"><div><span className="text-white">Model:</span> {activeAgent.model}</div><div><span className="text-white">Temperature:</span> {activeAgent.temperature}</div><div><span className="text-white">Top P:</span> {activeAgent.topP}</div><div><span className="text-white">Max tokens:</span> {activeAgent.maxTokens}</div><div><span className="text-white">Handoffs:</span> {activeAgent.handoffTargetIds.length}</div><div><span className="text-white">Debug:</span> {activeAgent.debug ? 'ON' : 'OFF'}</div></div> : null}
        </div>
      </Card>
    </div>
  );
}
