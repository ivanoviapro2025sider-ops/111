'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '@/types/agent';
import { AgentForm } from '@/components/agents/AgentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${params.id}`).then((r) => r.json()),
      fetch('/api/agents').then((r) => r.json()),
    ])
      .then(([agentData, agentsData]) => {
        if (agentData.agent) setAgent(agentData.agent);
        if (agentsData.agents) setAllAgents(agentsData.agents);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async (data: Partial<Agent>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.agent) {
        setAgent(result.agent);
      }
    } catch (e) {
      console.error('Failed to save agent:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents">
          <Button variant="outline">Back to Agents</Button>
        </Link>
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
          <h2 className="text-2xl font-semibold">{agent.name}</h2>
          <p className="text-muted-foreground text-sm">{agent.description || 'Configure agent settings'}</p>
        </div>
      </div>

      <AgentForm
        agent={agent}
        allAgents={allAgents}
        onSave={handleSave}
        isLoading={saving}
      />
    </div>
  );
}
