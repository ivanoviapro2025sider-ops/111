'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import AgentForm from '@/components/agents/AgentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { Agent, AgentUpdateInput } from '@/types/agent';
import Link from 'next/link';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { agents, fetchAgents, updateAgent } = useAgentStore();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const found = agents.find((a) => a.id === id);
    if (found) setAgent(found);
  }, [agents, id]);

  const handleSave = async (data: AgentUpdateInput) => {
    setSaving(true);
    try {
      await updateAgent(id, data);
      router.push('/agents');
    } finally {
      setSaving(false);
    }
  };

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description || 'Agent configuration'}</p>
        </div>
      </div>

      <AgentForm
        agent={agent}
        allAgents={agents}
        onSave={handleSave}
        isLoading={saving}
      />
    </div>
  );
}
