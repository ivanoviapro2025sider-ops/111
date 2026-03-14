'use client';

import { Agent } from '@/types/agent';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface SwarmConfigPanelProps {
  agent: Partial<Agent>;
  allAgents: Agent[];
  onChange: (field: string, value: unknown) => void;
}

export function SwarmConfigPanel({ agent, allAgents, onChange }: SwarmConfigPanelProps) {
  const otherAgents = allAgents.filter((a) => a.id !== (agent as Agent).id);
  const handoffTargets = (agent.handoffTargets || []) as string[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Max Turns</Label>
          <Input
            type="number"
            value={agent.maxTurns ?? 0}
            onChange={(e) => onChange('maxTurns', parseInt(e.target.value))}
            min={0}
          />
          <p className="text-xs text-muted-foreground">0 = unlimited</p>
        </div>
        <div className="space-y-2">
          <Label>Tool Choice</Label>
          <Select value={agent.toolChoice || 'auto'} onValueChange={(v) => onChange('toolChoice', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="required">Required</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {[
          { label: 'Execute Tools', field: 'executeTools', default: true },
          { label: 'Stream', field: 'stream', default: true },
          { label: 'Debug', field: 'debug', default: false },
          { label: 'Parallel Tool Calls', field: 'parallelToolCalls', default: true },
        ].map(({ label, field, default: def }) => (
          <div key={field} className="flex items-center gap-2">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={(agent[field as keyof typeof agent] as boolean) ?? def}
              onCheckedChange={(v) => onChange(field, v)}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Handoff Targets</Label>
        <div className="flex flex-wrap gap-2">
          {otherAgents.map((a) => {
            const selected = handoffTargets.includes(a.id);
            return (
              <Button
                key={a.id}
                variant={selected ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  onChange(
                    'handoffTargets',
                    selected
                      ? handoffTargets.filter((id) => id !== a.id)
                      : [...handoffTargets, a.id]
                  )
                }
                className="gap-1.5"
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}
              </Button>
            );
          })}
          {otherAgents.length === 0 && (
            <p className="text-sm text-muted-foreground">Create more agents to set up handoffs</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Handoff Conditions</Label>
        <Textarea
          value={agent.handoffConditions || ''}
          onChange={(e) => onChange('handoffConditions', e.target.value)}
          placeholder="Describe when this agent should hand off to others..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Context Variables (JSON)</Label>
        <Textarea
          value={JSON.stringify(agent.contextVariables || {}, null, 2)}
          onChange={(e) => {
            try { onChange('contextVariables', JSON.parse(e.target.value)); } catch { /* ignore */ }
          }}
          rows={4}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
