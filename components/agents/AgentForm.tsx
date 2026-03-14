'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AgentConfig } from '@/types/agent';
import { AgentParametersPanel } from '@/components/agents/AgentParametersPanel';
import { FunctionEditor } from '@/components/agents/FunctionEditor';
import { HandoffConfigurator } from '@/components/agents/HandoffConfigurator';
import { SwarmConfigPanel } from '@/components/agents/SwarmConfigPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const tabs = ['general', 'sampling', 'swarm', 'functions'] as const;
type Tab = (typeof tabs)[number];

export function AgentForm({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [allAgents, setAllAgents] = useState<AgentConfig[]>([]);
  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [agentResponse, allResponse] = await Promise.all([fetch(`/api/agents/${agentId}`, { cache: 'no-store' }), fetch('/api/agents', { cache: 'no-store' })]);
      const agentData = await agentResponse.json();
      const allData = await allResponse.json();
      setAgent(agentData.agent);
      setAllAgents(allData.agents ?? []);
    };
    void load();
  }, [agentId]);

  const updateAgent = (patch: Partial<AgentConfig>) => setAgent((current) => (current ? { ...current, ...patch } : current));
  const canSave = useMemo(() => Boolean(agent?.name?.trim()), [agent]);
  if (!agent) return <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-sm text-white/45">Loading agent...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm transition ${tab === item ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{item}</button>)}</div>
      {tab === 'general' ? <div className="grid gap-5 rounded-3xl border border-white/10 bg-white/5 p-6"><div className="grid gap-4 md:grid-cols-2"><label className="block text-sm text-white/70">Name<Input className="mt-2" value={agent.name} onChange={(event) => updateAgent({ name: event.target.value })} /></label><label className="block text-sm text-white/70">Model<Input className="mt-2" value={agent.model} onChange={(event) => updateAgent({ model: event.target.value })} /></label></div><label className="block text-sm text-white/70">Description<Textarea className="mt-2" value={agent.description} onChange={(event) => updateAgent({ description: event.target.value })} /></label><label className="block text-sm text-white/70">Instructions<Textarea className="mt-2 min-h-[240px] font-mono text-xs" value={agent.instructions} onChange={(event) => updateAgent({ instructions: event.target.value })} /></label><div className="grid gap-4 md:grid-cols-3"><label className="block text-sm text-white/70">Avatar<Input className="mt-2" value={agent.avatar} onChange={(event) => updateAgent({ avatar: event.target.value })} /></label><label className="block text-sm text-white/70">Color<Input className="mt-2" type="color" value={agent.color} onChange={(event) => updateAgent({ color: event.target.value })} /></label><label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/75 self-end"><input type="checkbox" checked={agent.isActive} onChange={(event) => updateAgent({ isActive: event.target.checked })} />Agent active</label></div></div> : null}
      {tab === 'sampling' ? <div className="rounded-3xl border border-white/10 bg-white/5 p-6"><AgentParametersPanel value={agent} onChange={updateAgent} /></div> : null}
      {tab === 'swarm' ? <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6"><SwarmConfigPanel value={agent} onChange={updateAgent} /><HandoffConfigurator agent={agent} allAgents={allAgents} onChange={(handoffTargetIds) => updateAgent({ handoffTargetIds })} /></div> : null}
      {tab === 'functions' ? <div className="rounded-3xl border border-white/10 bg-white/5 p-6"><FunctionEditor functions={agent.functions} onChange={(functions) => updateAgent({ functions })} /></div> : null}
      <div className="flex justify-end"><Button disabled={!canSave || saving} onClick={async () => { setSaving(true); await fetch(`/api/agents/${agent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agent) }); setSaving(false); }}>{saving ? 'Saving...' : 'Save agent'}</Button></div>
    </div>
  );
}
