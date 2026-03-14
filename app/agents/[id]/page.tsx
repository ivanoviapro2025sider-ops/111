'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agentStore';
import AgentForm from '@/components/agents/AgentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Agent } from '@/types/agent';

export default function AgentEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { agents, fetchAgents, updateAgent } = useAgentStore();
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const found = agents.find(a => a.id === params.id);
    if (found) setAgent(found);
  }, [agents, params.id]);

  const handleSave = async (data: Partial<Agent>) => {
    await updateAgent(params.id, data);
    router.push('/agents');
  };

  if (!agent) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading agent...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link href="/agents">
        <Button variant="ghost" size="sm" className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Agents
        </Button>
      </Link>

      <AgentForm
        agent={agent}
        allAgents={agents}
        onSave={handleSave}
        onCancel={() => router.push('/agents')}
      />
    </div>
  );
}
