import { notFound } from 'next/navigation';
import { AgentForm } from '@/components/agents/AgentForm';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) notFound();
  return (
    <div className="space-y-4">
      <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Agents</div><h2 className="text-3xl font-semibold text-white">Agent settings</h2></div>
      <AgentForm agentId={id} />
    </div>
  );
}
