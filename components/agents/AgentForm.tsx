'use client';

import { useState, useEffect } from 'react';
import { Agent, AgentFunction } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react';

interface AgentFormProps {
  agent?: Agent;
  allAgents: Agent[];
  onSave: (data: Partial<Agent>) => void;
  isLoading?: boolean;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function AgentForm({ agent, allAgents, onSave, isLoading }: AgentFormProps) {
  const [form, setForm] = useState<Partial<Agent>>({
    name: '',
    description: '',
    model: 'moonshotai/kimi-k2',
    instructions: '',
    isActive: true,
    avatar: 'bot',
    color: '#6366f1',
    temperature: 1.0,
    topP: 1.0,
    topK: 0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    repetitionPenalty: 1.0,
    minP: 0.0,
    topA: 0.0,
    maxTokens: 4096,
    seed: null,
    stop: [],
    responseFormat: 'text',
    maxTurns: 0,
    executeTools: true,
    stream: true,
    debug: false,
    contextVariables: {},
    handoffTargets: [],
    handoffConditions: '',
    toolChoice: 'auto',
    parallelToolCalls: true,
    functions: [],
  });

  useEffect(() => {
    if (agent) {
      setForm({
        ...agent,
        stop: typeof agent.stop === 'string' ? JSON.parse(agent.stop) : agent.stop,
        contextVariables: typeof agent.contextVariables === 'string' ? JSON.parse(agent.contextVariables) : agent.contextVariables,
        handoffTargets: typeof agent.handoffTargets === 'string' ? JSON.parse(agent.handoffTargets) : agent.handoffTargets,
        functions: typeof agent.functions === 'string' ? JSON.parse(agent.functions) : agent.functions,
      });
    }
  }, [agent]);

  const update = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => onSave(form);

  const resetDefaults = () => {
    setForm((prev) => ({
      ...prev,
      temperature: 1.0,
      topP: 1.0,
      topK: 0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      repetitionPenalty: 1.0,
      minP: 0.0,
      topA: 0.0,
      maxTokens: 4096,
      seed: null,
    }));
  };

  const addFunction = () => {
    const newFn: AgentFunction = {
      name: `function_${(form.functions?.length || 0) + 1}`,
      description: '',
      parameters: { type: 'object', properties: {} },
      implementation: '',
      isHandoff: false,
    };
    update('functions', [...(form.functions || []), newFn]);
  };

  const updateFunction = (index: number, field: string, value: unknown) => {
    const fns = [...(form.functions || [])];
    fns[index] = { ...fns[index], [field]: value };
    update('functions', fns);
  };

  const removeFunction = (index: number) => {
    update('functions', (form.functions || []).filter((_, i) => i !== index));
  };

  const otherAgents = allAgents.filter((a) => a.id !== agent?.id);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sampling">Sampling</TabsTrigger>
          <TabsTrigger value="swarm">Swarm</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="Agent name" />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={form.model || ''} onValueChange={(v) => update('model', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moonshotai/kimi-k2">Kimi K2</SelectItem>
                  <SelectItem value="moonshotai/kimi-k2-thinking">Kimi K2 Thinking</SelectItem>
                  <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Describe the agent's purpose"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>System Instructions</Label>
            <Textarea
              value={form.instructions || ''}
              onChange={(e) => update('instructions', e.target.value)}
              placeholder="System prompt with {context_variables} support..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <Switch checked={form.isActive ?? true} onCheckedChange={(v) => update('isActive', v)} />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? 'white' : 'transparent',
                    }}
                    onClick={() => update('color', c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sampling" className="space-y-6 mt-4">
          {[
            { label: 'Temperature', field: 'temperature', min: 0, max: 2, step: 0.1, default: 1.0 },
            { label: 'Top P', field: 'topP', min: 0, max: 1, step: 0.05, default: 1.0 },
            { label: 'Top K', field: 'topK', min: 0, max: 500, step: 1, default: 0 },
            { label: 'Frequency Penalty', field: 'frequencyPenalty', min: -2, max: 2, step: 0.1, default: 0 },
            { label: 'Presence Penalty', field: 'presencePenalty', min: -2, max: 2, step: 0.1, default: 0 },
            { label: 'Repetition Penalty', field: 'repetitionPenalty', min: 0, max: 2, step: 0.1, default: 1.0 },
            { label: 'Min P', field: 'minP', min: 0, max: 1, step: 0.05, default: 0 },
            { label: 'Top A', field: 'topA', min: 0, max: 1, step: 0.05, default: 0 },
          ].map(({ label, field, min, max, step }) => (
            <div key={field} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs"
                  value={form[field as keyof typeof form] as number}
                  onChange={(e) => update(field, parseFloat(e.target.value))}
                  step={step}
                  min={min}
                  max={max}
                />
              </div>
              <Slider
                value={[form[field as keyof typeof form] as number]}
                onValueChange={([v]) => update(field, v)}
                min={min}
                max={max}
                step={step}
              />
            </div>
          ))}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={form.maxTokens || 4096}
                onChange={(e) => update('maxTokens', parseInt(e.target.value))}
                min={1}
                max={131072}
              />
            </div>
            <div className="space-y-2">
              <Label>Seed (optional)</Label>
              <Input
                type="number"
                value={form.seed ?? ''}
                onChange={(e) => update('seed', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Random"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Response Format</Label>
            <div className="flex gap-4">
              {(['text', 'json_object'] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="responseFormat"
                    value={fmt}
                    checked={form.responseFormat === fmt}
                    onChange={() => update('responseFormat', fmt)}
                    className="text-primary"
                  />
                  <span className="text-sm capitalize">{fmt.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={resetDefaults} className="gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
        </TabsContent>

        <TabsContent value="swarm" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Max Turns</Label>
              <Input
                type="number"
                value={form.maxTurns || 0}
                onChange={(e) => update('maxTurns', parseInt(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">0 = unlimited</p>
            </div>
            <div className="space-y-2">
              <Label>Tool Choice</Label>
              <Select value={form.toolChoice || 'auto'} onValueChange={(v) => update('toolChoice', v)}>
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

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Label>Execute Tools</Label>
              <Switch checked={form.executeTools ?? true} onCheckedChange={(v) => update('executeTools', v)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Stream</Label>
              <Switch checked={form.stream ?? true} onCheckedChange={(v) => update('stream', v)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Debug</Label>
              <Switch checked={form.debug ?? false} onCheckedChange={(v) => update('debug', v)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Parallel Tool Calls</Label>
              <Switch checked={form.parallelToolCalls ?? true} onCheckedChange={(v) => update('parallelToolCalls', v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Handoff Targets</Label>
            <div className="flex flex-wrap gap-2">
              {otherAgents.map((a) => {
                const selected = (form.handoffTargets || []).includes(a.id);
                return (
                  <Button
                    key={a.id}
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const targets = form.handoffTargets || [];
                      update(
                        'handoffTargets',
                        selected ? targets.filter((id) => id !== a.id) : [...targets, a.id]
                      );
                    }}
                    className="gap-1"
                  >
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </Button>
                );
              })}
              {otherAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">No other agents available</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Handoff Conditions</Label>
            <Textarea
              value={form.handoffConditions || ''}
              onChange={(e) => update('handoffConditions', e.target.value)}
              placeholder="Describe when this agent should hand off to others..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Context Variables (JSON)</Label>
            <Textarea
              value={JSON.stringify(form.contextVariables || {}, null, 2)}
              onChange={(e) => {
                try {
                  update('contextVariables', JSON.parse(e.target.value));
                } catch { /* ignore */ }
              }}
              rows={4}
              className="font-mono text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Label>Agent Functions</Label>
            <Button variant="outline" size="sm" onClick={addFunction} className="gap-1">
              <Plus className="h-3 w-3" />
              Add Function
            </Button>
          </div>

          {(form.functions || []).map((fn, idx) => (
            <div key={idx} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Function #{idx + 1}</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFunction(idx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={fn.name}
                    onChange={(e) => updateFunction(idx, 'name', e.target.value)}
                    placeholder="function_name"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Handoff?</Label>
                  <Switch
                    checked={fn.isHandoff}
                    onCheckedChange={(v) => updateFunction(idx, 'isHandoff', v)}
                  />
                  {fn.isHandoff && (
                    <Select
                      value={fn.handoffTarget || ''}
                      onValueChange={(v) => updateFunction(idx, 'handoffTarget', v)}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue placeholder="Target agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherAgents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  value={fn.description}
                  onChange={(e) => updateFunction(idx, 'description', e.target.value)}
                  placeholder="What does this function do?"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parameters (JSON Schema)</Label>
                <Textarea
                  value={JSON.stringify(fn.parameters, null, 2)}
                  onChange={(e) => {
                    try { updateFunction(idx, 'parameters', JSON.parse(e.target.value)); } catch { /* ignore */ }
                  }}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Implementation (JavaScript)</Label>
                <Textarea
                  value={fn.implementation}
                  onChange={(e) => updateFunction(idx, 'implementation', e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="// JavaScript code here..."
                />
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={isLoading} className="gap-1">
          <Save className="h-4 w-4" />
          Save Agent
        </Button>
      </div>
    </div>
  );
}
