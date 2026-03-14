'use client';

import { AgentFunction } from '@/types/agent';
import { Agent } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Code } from 'lucide-react';

interface FunctionEditorProps {
  functions: AgentFunction[];
  allAgents: Agent[];
  currentAgentId?: string;
  onChange: (functions: AgentFunction[]) => void;
}

export function FunctionEditor({ functions, allAgents, currentAgentId, onChange }: FunctionEditorProps) {
  const otherAgents = allAgents.filter((a) => a.id !== currentAgentId);

  const addFunction = () => {
    const newFn: AgentFunction = {
      name: `function_${functions.length + 1}`,
      description: '',
      parameters: { type: 'object', properties: {} },
      implementation: '',
      isHandoff: false,
    };
    onChange([...functions, newFn]);
  };

  const updateFn = (index: number, field: keyof AgentFunction, value: unknown) => {
    const updated = [...functions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeFn = (index: number) => {
    onChange(functions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Functions / Tools</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define custom functions this agent can call
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addFunction} className="gap-1">
          <Plus className="h-3 w-3" />
          Add Function
        </Button>
      </div>

      {functions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
          <Code className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No functions defined</p>
          <Button variant="ghost" size="sm" onClick={addFunction} className="mt-2">
            Add your first function
          </Button>
        </div>
      )}

      {functions.map((fn, idx) => (
        <div key={idx} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <h4 className="font-medium text-sm">
                {fn.name || `Function #${idx + 1}`}
              </h4>
              {fn.isHandoff && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Handoff
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFn(idx)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Function Name</Label>
              <Input
                value={fn.name}
                onChange={(e) => updateFn(idx, 'name', e.target.value)}
                placeholder="my_function"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Handoff</Label>
                <Switch
                  checked={fn.isHandoff}
                  onCheckedChange={(v) => updateFn(idx, 'isHandoff', v)}
                />
              </div>
              {fn.isHandoff && (
                <Select
                  value={fn.handoffTarget || ''}
                  onValueChange={(v) => updateFn(idx, 'handoffTarget', v)}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Target agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={fn.description}
              onChange={(e) => updateFn(idx, 'description', e.target.value)}
              placeholder="What does this function do?"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Parameters (JSON Schema)</Label>
            <Textarea
              value={typeof fn.parameters === 'string' ? fn.parameters : JSON.stringify(fn.parameters, null, 2)}
              onChange={(e) => {
                try { updateFn(idx, 'parameters', JSON.parse(e.target.value)); } catch { /* ignore */ }
              }}
              rows={3}
              className="font-mono text-xs"
              placeholder='{"type": "object", "properties": {...}}'
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Implementation (JavaScript)</Label>
            <Textarea
              value={fn.implementation}
              onChange={(e) => updateFn(idx, 'implementation', e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder="// JavaScript code here...&#10;async function execute(params) {&#10;  return { result: 'done' };&#10;}"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
