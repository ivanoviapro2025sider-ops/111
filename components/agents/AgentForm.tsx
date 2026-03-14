'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Plus, RotateCcw, Save } from 'lucide-react';
import type { Agent, AgentUpdateInput } from '@/types/agent';

interface AgentFormProps {
  agent: Agent;
  allAgents: Agent[];
  onSave: (data: AgentUpdateInput) => Promise<void>;
  isLoading?: boolean;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6b7280',
];

export default function AgentForm({ agent, allAgents, onSave, isLoading }: AgentFormProps) {
  const [form, setForm] = useState<AgentUpdateInput>({ ...agent });
  const [stopInput, setStopInput] = useState('');

  useEffect(() => {
    setForm({ ...agent });
  }, [agent]);

  const update = <K extends keyof AgentUpdateInput>(key: K, value: AgentUpdateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => onSave(form);

  const resetDefaults = () => {
    update('temperature', 1.0);
    update('topP', 1.0);
    update('topK', 0);
    update('frequencyPenalty', 0.0);
    update('presencePenalty', 0.0);
    update('repetitionPenalty', 1.0);
    update('minP', 0.0);
    update('topA', 0.0);
    update('maxTokens', 4096);
    update('seed', null);
    update('stop', []);
    update('responseFormat', 'text');
  };

  const addStop = () => {
    if (stopInput.trim()) {
      update('stop', [...(form.stop || []), stopInput.trim()]);
      setStopInput('');
    }
  };

  const removeStop = (index: number) => {
    update('stop', (form.stop || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sampling">Sampling</TabsTrigger>
          <TabsTrigger value="swarm">Swarm</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name || ''}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={form.model || ''} onValueChange={(v) => update('model', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moonshotai/kimi-k2">moonshotai/kimi-k2</SelectItem>
                  <SelectItem value="moonshotai/kimi-k2-thinking">moonshotai/kimi-k2-thinking</SelectItem>
                  <SelectItem value="openai/gpt-4o">openai/gpt-4o</SelectItem>
                  <SelectItem value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">System Instructions</Label>
            <Textarea
              id="instructions"
              value={form.instructions || ''}
              onChange={(e) => update('instructions', e.target.value)}
              rows={8}
              className="font-mono text-sm"
              placeholder="Enter system prompt... Use {variable_name} for context variables."
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(v) => update('isActive', v)}
              />
              <Label>Active</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    form.color === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => update('color', color)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sampling" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetDefaults}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to Defaults
            </Button>
          </div>

          {[
            { label: 'Temperature', key: 'temperature' as const, min: 0, max: 2, step: 0.1 },
            { label: 'Top P', key: 'topP' as const, min: 0, max: 1, step: 0.05 },
            { label: 'Frequency Penalty', key: 'frequencyPenalty' as const, min: -2, max: 2, step: 0.1 },
            { label: 'Presence Penalty', key: 'presencePenalty' as const, min: -2, max: 2, step: 0.1 },
            { label: 'Repetition Penalty', key: 'repetitionPenalty' as const, min: 0, max: 2, step: 0.1 },
            { label: 'Min P', key: 'minP' as const, min: 0, max: 1, step: 0.05 },
            { label: 'Top A', key: 'topA' as const, min: 0, max: 1, step: 0.05 },
          ].map(({ label, key, min, max, step }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between">
                <Label>{label}</Label>
                <span className="text-sm text-muted-foreground">{(form[key] as number) ?? 0}</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[Number(form[key]) || 0]}
                  onValueChange={([v]) => update(key, v)}
                  min={min}
                  max={max}
                  step={step}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={form[key] ?? 0}
                  onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
                  className="w-20"
                  min={min}
                  max={max}
                  step={step}
                />
              </div>
            </div>
          ))}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Top K</Label>
              <Input
                type="number"
                value={form.topK ?? 0}
                onChange={(e) => update('topK', parseInt(e.target.value) || 0)}
                min={0}
                max={500}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={form.maxTokens ?? 4096}
                onChange={(e) => update('maxTokens', parseInt(e.target.value) || 4096)}
                min={1}
                max={131072}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stop Sequences</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(form.stop || []).map((s, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {s}
                  <button onClick={() => removeStop(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={stopInput}
                onChange={(e) => setStopInput(e.target.value)}
                placeholder="Add stop sequence"
                onKeyDown={(e) => e.key === 'Enter' && addStop()}
              />
              <Button variant="outline" size="icon" onClick={addStop}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Response Format</Label>
            <Select
              value={form.responseFormat || 'text'}
              onValueChange={(v) => update('responseFormat', v as 'text' | 'json_object')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="json_object">JSON Object</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="swarm" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Turns</Label>
              <Input
                type="number"
                value={form.maxTurns ?? 0}
                onChange={(e) => update('maxTurns', parseInt(e.target.value) || 0)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">0 = unlimited</p>
            </div>
            <div className="space-y-2">
              <Label>Tool Choice</Label>
              <Select
                value={form.toolChoice || 'auto'}
                onValueChange={(v) => update('toolChoice', v as 'none' | 'auto' | 'required')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Execute Tools', key: 'executeTools' as const },
              { label: 'Stream Responses', key: 'stream' as const },
              { label: 'Debug Mode', key: 'debug' as const },
              { label: 'Parallel Tool Calls', key: 'parallelToolCalls' as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch
                  checked={form[key] as boolean ?? true}
                  onCheckedChange={(v) => update(key, v)}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Handoff Targets</Label>
            <div className="flex flex-wrap gap-2">
              {allAgents
                .filter((a) => a.id !== agent.id)
                .map((a) => {
                  const selected = (form.handoffTargets || []).includes(a.id);
                  return (
                    <Badge
                      key={a.id}
                      variant={selected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const targets = form.handoffTargets || [];
                        update(
                          'handoffTargets',
                          selected ? targets.filter((t) => t !== a.id) : [...targets, a.id]
                        );
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: a.color }}
                      />
                      {a.name}
                    </Badge>
                  );
                })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Handoff Conditions</Label>
            <Textarea
              value={form.handoffConditions || ''}
              onChange={(e) => update('handoffConditions', e.target.value)}
              rows={3}
              placeholder="Describe when this agent should hand off to other agents..."
            />
          </div>

          <div className="space-y-2">
            <Label>Context Variables (JSON)</Label>
            <Textarea
              value={
                typeof form.contextVariables === 'string'
                  ? form.contextVariables
                  : JSON.stringify(form.contextVariables || {}, null, 2)
              }
              onChange={(e) => {
                try {
                  update('contextVariables', JSON.parse(e.target.value));
                } catch {
                  // Allow invalid JSON while typing
                }
              }}
              rows={4}
              className="font-mono text-sm"
              placeholder="{}"
            />
          </div>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4 mt-4">
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">Define custom functions for this agent</p>
            <p className="text-sm">
              Functions allow the agent to perform actions and can include handoff functions
              to transfer control to other agents.
            </p>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Function
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Agent
        </Button>
      </div>
    </div>
  );
}
