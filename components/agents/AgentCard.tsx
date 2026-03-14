import Link from 'next/link';
import { ArrowRightLeft } from 'lucide-react';
import type { AgentConfig } from '@/types/agent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function AgentCard({ agent }: { agent: AgentConfig }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: agent.color }} /><h3 className="text-lg font-semibold text-white">{agent.name}</h3></div>
          <p className="mt-3 text-sm text-white/60">{agent.description}</p>
        </div>
        <Badge className={agent.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : ''}>{agent.isActive ? 'Active' : 'Disabled'}</Badge>
      </div>
      <div className="mt-5 space-y-2 text-sm text-white/70"><div>Model: <span className="text-white">{agent.model}</span></div><div>Temperature: <span className="text-white">{agent.temperature}</span></div><div className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Handoffs: {agent.handoffTargetIds.length}</div></div>
      <div className="mt-5 flex gap-3"><Link href={`/agents/${agent.id}`} className="flex-1"><Button className="w-full" variant="secondary">Edit</Button></Link></div>
    </Card>
  );
}
