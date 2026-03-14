'use client';

import React, { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import AgentCard from '@/components/agents/AgentCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Bot, ArrowRight } from 'lucide-react';

export default function AgentsPage() {
  const { agents, fetchAgents, createAgent, deleteAgent, isLoading } = useAgentStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAgent({
      name: newName.trim(),
      description: newDescription.trim(),
      model: 'moonshotai/kimi-k2',
      instructions: '',
      isActive: true,
      avatar: 'bot',
      color: '#6366f1',
      temperature: 1.0,
      topP: 1.0,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
      minP: 0,
      topA: 0,
      maxTokens: 4096,
      seed: null,
      stop: [],
      responseFormat: 'text',
      maxTurns: 0,
      executeTools: true,
      stream: true,
      debug: false,
      contextVariables: {},
      handoffTargets: [],
      handoffConditions: '',
      toolChoice: 'auto',
      parallelToolCalls: true,
      functions: [],
    });
    setNewName('');
    setNewDescription('');
    setShowCreate(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Manage your Swarm agents and their configurations</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>Add a new agent to your swarm network</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Agent Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Triage Agent"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What does this agent do?"
                />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first agent to start building a Swarm network
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                allAgents={agents}
                onDelete={deleteAgent}
              />
            ))}
          </div>

          {agents.length > 1 && (
            <div className="border border-border rounded-xl p-6 bg-card">
              <h2 className="text-lg font-semibold mb-4">Swarm Topology</h2>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {agents.map((agent, i) => {
                  const targets = (agent.handoffTargets || [])
                    .map((t) => agents.find((a) => a.id === t || a.name === t)?.name)
                    .filter(Boolean);

                  return (
                    <div key={agent.id} className="flex items-center gap-2">
                      <div
                        className="px-4 py-2 rounded-lg border-2 text-sm font-medium"
                        style={{ borderColor: agent.color }}
                      >
                        {agent.name}
                      </div>
                      {targets.length > 0 && (
                        <>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {targets.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
