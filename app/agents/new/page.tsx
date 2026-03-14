'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('moonshotai/kimi-k2');
  const [saving, setSaving] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-white/35">Agents</div>
        <h2 className="text-3xl font-semibold text-white">Создать нового агента</h2>
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
        <label className="block text-sm text-white/70">
          Name
          <Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="block text-sm text-white/70">
          Description
          <Textarea className="mt-2" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <label className="block text-sm text-white/70">
          Model
          <Input className="mt-2" value={model} onChange={(event) => setModel(event.target.value)} />
        </label>

        <div className="flex justify-end">
          <Button
            disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true);
              const response = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name,
                  description,
                  model,
                  instructions: 'You are a helpful KIMI swarm agent.',
                  isActive: true,
                  functions: [],
                }),
              });
              const data = await response.json();
              setSaving(false);
              if (data.agent?.id) {
                router.push(`/agents/${data.agent.id}`);
              }
            }}
          >
            {saving ? 'Creating...' : 'Create agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}
