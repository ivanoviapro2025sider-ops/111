'use client';

import { useEffect, useState } from 'react';
import { Agent } from '@/types/agent';
import { AgentCard } from '@/components/agents/AgentCard';
import { Button } from '@/components/ui/button';
import { Plus, Bot } from 'lucide-react';
import Link from 'next/link';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.agents) setAgents(data.agents);
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error('Failed to delete agent:', e);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, isActive } : a)));
    } catch (e) {
      console.error('Failed to toggle agent:', e);
    }
  };

  const handleCreateAgent = async () => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Agent ${agents.length + 1}`,
          description: 'New agent',
          model: 'moonshotai/kimi-k2',
        }),
      });
      const data = await res.json();
      if (data.agent) setAgents((prev) => [data.agent, ...prev]);
    } catch (e) {
      console.error('Failed to create agent:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Agents</h2>
          <p className="text-muted-foreground text-sm">Manage your Swarm agents</p>
        </div>
        <Button onClick={handleCreateAgent} className="gap-2">
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium">No agents yet</h3>
          <p className="text-muted-foreground text-sm">Create your first agent to get started</p>
          <Button onClick={handleCreateAgent} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              allAgents={agents}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {agents.length > 1 && (
        <>
          <div className="mt-8 mb-4">
            <h3 className="text-lg font-semibold">Swarm Topology</h3>
            <p className="text-sm text-muted-foreground">Visual overview of agent handoff connections</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-center justify-center gap-8">
              {agents.map((agent) => {
                const targets = (agent.handoffTargets || [])
                  .map((id) => agents.find((a) => a.id === id))
                  .filter(Boolean);
                return (
                  <div key={agent.id} className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: agent.color }}
                      >
                        <Bot className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-xs font-medium">{agent.name}</span>
                    </div>
                    {targets.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">→</span>
                        <div className="flex flex-col gap-1">
                          {targets.map((t) => (
                            <span key={t!.id} className="text-xs" style={{ color: t!.color }}>
                              {t!.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
