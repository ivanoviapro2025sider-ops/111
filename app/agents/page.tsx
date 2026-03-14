'use client';

import React, { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import AgentCard from '@/components/agents/AgentCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AgentForm from '@/components/agents/AgentForm';
import { Plus, Bot } from 'lucide-react';
import { Agent } from '@/types/agent';

export default function AgentsPage() {
  const { agents, fetchAgents, createAgent, deleteAgent } = useAgentStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async (data: Partial<Agent>) => {
    await createAgent(data);
    setShowCreate(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      await deleteAgent(id);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm">Manage your Swarm agents and their configurations</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bot className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No agents yet</p>
          <p className="text-sm mb-6">Create your first agent to get started with Swarm</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Agent
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                allAgents={agents}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {agents.length > 1 && (
            <div className="border rounded-xl p-6">
              <h3 className="text-sm font-medium mb-4">Swarm Topology</h3>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {agents.map((agent) => {
                  const targets = (agent.handoffTargets || [])
                    .map(id => agents.find(a => a.id === id))
                    .filter(Boolean);

                  return (
                    <div key={agent.id} className="flex items-center gap-2">
                      <div
                        className="px-3 py-2 rounded-lg border text-sm font-medium"
                        style={{ borderColor: agent.color, color: agent.color }}
                      >
                        {agent.name}
                      </div>
                      {targets.length > 0 && (
                        <div className="text-muted-foreground text-xs">
                          → {targets.map(t => t!.name).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
          </DialogHeader>
          <AgentForm
            allAgents={agents}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
