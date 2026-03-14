'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AgentCard } from '@/components/agents/AgentCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAgentStore } from '@/stores/agentStore';

export default function AgentsPage() {
  const { agents, loadAgents } = useAgentStore();
  useEffect(() => { void loadAgents(); }, [loadAgents]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Swarm agents</div><h2 className="text-3xl font-semibold text-white">Управление агентами</h2></div>
        <Link href="/agents/new"><Button><Plus className="mr-2 h-4 w-4" />New agent</Button></Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">{agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}</div>
      <Card className="p-6"><div className="mb-4 text-lg font-medium text-white">Swarm topology</div><div className="flex flex-wrap items-center gap-3 text-sm text-white/65">{agents.map((agent) => <div key={agent.id} className="flex items-center gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">{agent.name}</div>{agent.handoffTargetIds.length ? <span className="text-indigo-300">→</span> : null}</div>)}</div></Card>
    </div>
  );
}
