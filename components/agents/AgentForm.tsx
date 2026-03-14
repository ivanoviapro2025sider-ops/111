'use client';

import React, { useState, useEffect } from 'react';
import { Agent, DEFAULT_AGENT } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, X, Plus } from 'lucide-react';

interface AgentFormProps {
  agent?: Agent;
  allAgents: Agent[];
  onSave: (data: Partial<Agent>) => Promise<void>;
  onCancel?: () => void;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const MODELS = [
  'moonshotai/kimi-k2',
  'moonshotai/kimi-k2-thinking',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-pro',
  'meta-llama/llama-4-maverick',
];

export default function AgentForm({ agent, allAgents, onSave, onCancel }: AgentFormProps) {
  const [form, setForm] = useState<Partial<Agent>>(agent || { ...DEFAULT_AGENT, name: '' });
  const [saving, setSaving] = useState(false);
  const [stopInput, setStopInput] = useState('');

  useEffect(() => {
    if (agent) setForm(agent);
  }, [agent]);

  const update = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(agent || { ...DEFAULT_AGENT, name: '' });
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

  const otherAgents = allAgents.filter(a => a.id !== agent?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{agent ? `Edit ${agent.name}` : 'New Agent'}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reset
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name}>
            <Save className="w-3 h-3 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sampling">Sampling</TabsTrigger>
          <TabsTrigger value="swarm">Swarm</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name || ''}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Agent name"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={form.model || 'moonshotai/kimi-k2'}
                onValueChange={(v) => update('model', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What does this agent do?"
            />
          </div>

          <div className="space-y-2">
            <Label>System Instructions</Label>
            <Textarea
              value={form.instructions || ''}
              onChange={(e) => update('instructions', e.target.value)}
              placeholder="You are a helpful assistant..."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{variable_name}}'} for context variables
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(v) => update('isActive', v)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => update('color', color)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sampling" className="space-y-5 mt-4">
          <ParamSlider label="Temperature" value={form.temperature ?? 1.0} min={0} max={2} step={0.01} onChange={(v) => update('temperature', v)} />
          <ParamSlider label="Top P" value={form.topP ?? 1.0} min={0} max={1} step={0.01} onChange={(v) => update('topP', v)} />
          <ParamSlider label="Top K" value={form.topK ?? 0} min={0} max={500} step={1} onChange={(v) => update('topK', v)} />
          <ParamSlider label="Frequency Penalty" value={form.frequencyPenalty ?? 0} min={-2} max={2} step={0.01} onChange={(v) => update('frequencyPenalty', v)} />
          <ParamSlider label="Presence Penalty" value={form.presencePenalty ?? 0} min={-2} max={2} step={0.01} onChange={(v) => update('presencePenalty', v)} />
          <ParamSlider label="Repetition Penalty" value={form.repetitionPenalty ?? 1} min={0} max={2} step={0.01} onChange={(v) => update('repetitionPenalty', v)} />
          <ParamSlider label="Min P" value={form.minP ?? 0} min={0} max={1} step={0.01} onChange={(v) => update('minP', v)} />
          <ParamSlider label="Top A" value={form.topA ?? 0} min={0} max={1} step={0.01} onChange={(v) => update('topA', v)} />

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

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Seed</Label>
              <Switch
                checked={form.seed !== null && form.seed !== undefined}
                onCheckedChange={(v) => update('seed', v ? 42 : null)}
              />
            </div>
            {form.seed !== null && form.seed !== undefined && (
              <Input
                type="number"
                value={form.seed}
                onChange={(e) => update('seed', parseInt(e.target.value))}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Stop Sequences</Label>
            <div className="flex gap-2">
              <Input
                value={stopInput}
                onChange={(e) => setStopInput(e.target.value)}
                placeholder="Add stop sequence"
                onKeyDown={(e) => e.key === 'Enter' && addStop()}
              />
              <Button variant="outline" size="sm" onClick={addStop}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(form.stop || []).map((s, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {s}
                  <button onClick={() => removeStop(i)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Response Format</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={form.responseFormat === 'text'}
                  onChange={() => update('responseFormat', 'text')}
                  className="accent-primary"
                />
                Text
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={form.responseFormat === 'json_object'}
                  onChange={() => update('responseFormat', 'json_object')}
                  className="accent-primary"
                />
                JSON
              </label>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => {
            update('temperature', 1.0);
            update('topP', 1.0);
            update('topK', 0);
            update('frequencyPenalty', 0);
            update('presencePenalty', 0);
            update('repetitionPenalty', 1.0);
            update('minP', 0);
            update('topA', 0);
            update('maxTokens', 4096);
            update('seed', null);
            update('stop', []);
            update('responseFormat', 'text');
          }}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reset to Defaults
          </Button>
        </TabsContent>

        <TabsContent value="swarm" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Max Turns (0 = unlimited)</Label>
            <Input
              type="number"
              value={form.maxTurns ?? 0}
              onChange={(e) => update('maxTurns', parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Execute Tools</Label>
            <Switch
              checked={form.executeTools ?? true}
              onCheckedChange={(v) => update('executeTools', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Streaming</Label>
            <Switch
              checked={form.stream ?? true}
              onCheckedChange={(v) => update('stream', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Debug Mode</Label>
            <Switch
              checked={form.debug ?? false}
              onCheckedChange={(v) => update('debug', v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tool Choice</Label>
            <Select
              value={form.toolChoice || 'auto'}
              onValueChange={(v) => update('toolChoice', v)}
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

          <div className="flex items-center justify-between">
            <Label>Parallel Tool Calls</Label>
            <Switch
              checked={form.parallelToolCalls ?? true}
              onCheckedChange={(v) => update('parallelToolCalls', v)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Handoff Targets</Label>
            <div className="space-y-2">
              {otherAgents.map((a) => {
                const selected = (form.handoffTargets || []).includes(a.id);
                return (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          update('handoffTargets', [...(form.handoffTargets || []), a.id]);
                        } else {
                          update('handoffTargets', (form.handoffTargets || []).filter(id => id !== a.id));
                        }
                      }}
                      className="accent-primary"
                    />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </label>
                );
              })}
              {otherAgents.length === 0 && (
                <p className="text-xs text-muted-foreground">Create more agents to configure handoffs</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Handoff Conditions</Label>
            <Textarea
              value={form.handoffConditions || ''}
              onChange={(e) => update('handoffConditions', e.target.value)}
              placeholder="Describe when this agent should hand off to others..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Context Variables (JSON)</Label>
            <Textarea
              value={typeof form.contextVariables === 'string' ? form.contextVariables : JSON.stringify(form.contextVariables || {}, null, 2)}
              onChange={(e) => {
                try {
                  update('contextVariables', JSON.parse(e.target.value));
                } catch {
                  // Allow invalid JSON during editing
                }
              }}
              className="min-h-[100px] font-mono text-sm"
              placeholder='{}'
            />
          </div>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4 mt-4">
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm mb-4">
              Define custom functions that this agent can call.
            </p>
            <FunctionEditor
              functions={form.functions || []}
              onChange={(fns) => update('functions', fns)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || min)}
          className="w-20 h-7 text-xs text-right"
          min={min}
          max={max}
          step={step}
        />
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function FunctionEditor({
  functions,
  onChange,
}: {
  functions: Agent['functions'];
  onChange: (fns: Agent['functions']) => void;
}) {
  const addFunction = () => {
    onChange([
      ...functions,
      {
        name: '',
        description: '',
        parameters: { type: 'object', properties: {} },
        implementation: '',
        isHandoff: false,
      },
    ]);
  };

  const updateFunction = (index: number, updates: Partial<Agent['functions'][0]>) => {
    const updated = [...functions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeFunction = (index: number) => {
    onChange(functions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {functions.map((fn, index) => (
        <Card key={index}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Function #{index + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeFunction(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={fn.name}
                  onChange={(e) => updateFunction(index, { name: e.target.value })}
                  placeholder="function_name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Handoff</Label>
                  <Switch
                    checked={fn.isHandoff}
                    onCheckedChange={(v) => updateFunction(index, { isHandoff: v })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={fn.description}
                onChange={(e) => updateFunction(index, { description: e.target.value })}
                placeholder="What does this function do?"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Parameters (JSON Schema)</Label>
              <Textarea
                value={JSON.stringify(fn.parameters, null, 2)}
                onChange={(e) => {
                  try {
                    updateFunction(index, { parameters: JSON.parse(e.target.value) });
                  } catch {
                    // Allow invalid JSON during editing
                  }
                }}
                className="min-h-[80px] font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Implementation (JavaScript)</Label>
              <Textarea
                value={fn.implementation}
                onChange={(e) => updateFunction(index, { implementation: e.target.value })}
                className="min-h-[100px] font-mono text-xs"
                placeholder="// Function implementation"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full gap-2" onClick={addFunction}>
        <Plus className="w-4 h-4" /> Add Function
      </Button>
    </div>
  );
}
