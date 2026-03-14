"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AgentFunction } from "@/types/agent";

interface FunctionEditorProps {
  functions: AgentFunction[];
  onChange: (value: AgentFunction[]) => void;
}

export function FunctionEditor({ functions, onChange }: FunctionEditorProps) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Functions / Tools</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange([
              ...functions,
              {
                id: crypto.randomUUID(),
                name: "new_function",
                description: "",
                parameters: {
                  type: "object",
                  properties: {},
                  required: [],
                },
                implementation: "return { ok: true };",
                isHandoff: false,
              },
            ])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add function
        </Button>
      </div>
      <div className="space-y-3">
        {functions.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-md border border-zinc-800 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Function name"
                value={item.name}
                onChange={(event) =>
                  onChange(
                    functions.map((fn, idx) =>
                      idx === index ? { ...fn, name: event.target.value } : fn,
                    ),
                  )
                }
              />
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(event) =>
                  onChange(
                    functions.map((fn, idx) =>
                      idx === index ? { ...fn, description: event.target.value } : fn,
                    ),
                  )
                }
              />
              <Button
                size="icon"
                variant="destructive"
                onClick={() => onChange(functions.filter((_, idx) => idx !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={JSON.stringify(item.parameters, null, 2)}
              onChange={(event) => {
                let parsed: Record<string, unknown> = item.parameters;
                try {
                  parsed = JSON.parse(event.target.value);
                } catch {
                  parsed = item.parameters;
                }
                onChange(
                  functions.map((fn, idx) =>
                    idx === index ? { ...fn, parameters: parsed } : fn,
                  ),
                );
              }}
              className="min-h-24 font-mono text-xs"
            />
            <Textarea
              value={item.implementation}
              onChange={(event) =>
                onChange(
                  functions.map((fn, idx) =>
                    idx === index ? { ...fn, implementation: event.target.value } : fn,
                  ),
                )
              }
              className="min-h-24 font-mono text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={item.isHandoff}
                onChange={(event) =>
                  onChange(
                    functions.map((fn, idx) =>
                      idx === index ? { ...fn, isHandoff: event.target.checked } : fn,
                    ),
                  )
                }
              />
              Handoff function
            </label>
            {item.isHandoff && (
              <Input
                placeholder="Target agent id"
                value={item.handoffTarget ?? ""}
                onChange={(event) =>
                  onChange(
                    functions.map((fn, idx) =>
                      idx === index ? { ...fn, handoffTarget: event.target.value } : fn,
                    ),
                  )
                }
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
