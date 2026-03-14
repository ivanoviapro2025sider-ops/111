"use client";

import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface FunctionDraft {
  name: string;
  description: string;
  parameters: string;
  implementation: string;
  isHandoff: boolean;
  handoffTarget?: string;
}

interface FunctionEditorProps {
  value: FunctionDraft[];
  handoffTargets: Array<{ id: string; name: string }>;
  onChange: (next: FunctionDraft[]) => void;
}

export function FunctionEditor({ value, handoffTargets, onChange }: FunctionEditorProps) {
  const addFunction = () => {
    onChange([
      ...value,
      {
        name: "",
        description: "",
        parameters: JSON.stringify(
          {
            type: "object",
            properties: {},
          },
          null,
          2,
        ),
        implementation: "return { ok: true };",
        isHandoff: false,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-100">Functions / Tools</h4>
        <Button size="sm" onClick={addFunction}>
          Add Function
        </Button>
      </div>

      {value.map((fn, idx) => (
        <div key={`fn-${idx}`} className="space-y-2 rounded-lg border border-zinc-800 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Function name"
              value={fn.name}
              onChange={(event) => {
                const next = [...value];
                next[idx].name = event.target.value;
                onChange(next);
              }}
            />
            <Input
              placeholder="Description"
              value={fn.description}
              onChange={(event) => {
                const next = [...value];
                next[idx].description = event.target.value;
                onChange(next);
              }}
            />
          </div>

          <Textarea
            rows={6}
            placeholder="JSON Schema parameters"
            value={fn.parameters}
            onChange={(event) => {
              const next = [...value];
              next[idx].parameters = event.target.value;
              onChange(next);
            }}
          />

          <div className="space-y-1">
            <p className="text-xs text-zinc-400">Implementation</p>
            <Editor
              height="180px"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={fn.implementation}
              onChange={(code) => {
                const next = [...value];
                next[idx].implementation = code || "";
                onChange(next);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={fn.isHandoff}
              onCheckedChange={(checked) => {
                const next = [...value];
                next[idx].isHandoff = checked;
                onChange(next);
              }}
            />
            <p className="text-xs text-zinc-300">Handoff function</p>
            {fn.isHandoff ? (
              <select
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
                value={fn.handoffTarget || ""}
                onChange={(event) => {
                  const next = [...value];
                  next[idx].handoffTarget = event.target.value;
                  onChange(next);
                }}
              >
                <option value="">Select target agent</option>
                {handoffTargets.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
