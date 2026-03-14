"use client";

import type { AgentFunction } from "@/types/agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export function FunctionEditor({
  functions,
  onChange,
}: {
  functions: AgentFunction[];
  onChange: (functions: AgentFunction[]) => void;
}) {
  return (
    <div className="space-y-3">
      {functions.map((fn, index) => (
        <div key={`${fn.name}-${index}`} className="rounded-lg border border-zinc-700 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={fn.name}
              onChange={(e) =>
                onChange(
                  functions.map((item, i) =>
                    i === index ? { ...item, name: e.target.value } : item,
                  ),
                )
              }
              placeholder="Function name"
            />
            <Switch
              checked={fn.isHandoff}
              label="handoff"
              onChange={(e) =>
                onChange(
                  functions.map((item, i) =>
                    i === index ? { ...item, isHandoff: e.target.checked } : item,
                  ),
                )
              }
            />
          </div>
          <Textarea
            className="mt-2"
            value={fn.description}
            onChange={(e) =>
              onChange(
                functions.map((item, i) =>
                  i === index ? { ...item, description: e.target.value } : item,
                ),
              )
            }
            placeholder="Description"
          />
          <Textarea
            className="mt-2 font-mono text-xs"
            value={JSON.stringify(fn.parameters, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(
                  functions.map((item, i) =>
                    i === index ? { ...item, parameters: parsed } : item,
                  ),
                );
              } catch {
                // ignore JSON parse errors while typing
              }
            }}
          />
          <Textarea
            className="mt-2 font-mono text-xs"
            value={fn.implementation}
            onChange={(e) =>
              onChange(
                functions.map((item, i) =>
                  i === index ? { ...item, implementation: e.target.value } : item,
                ),
              )
            }
            placeholder="JavaScript implementation"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([
            ...functions,
            {
              name: `tool_${functions.length + 1}`,
              description: "",
              parameters: { type: "object", properties: {} },
              implementation: "return { ok: true };",
              isHandoff: false,
            },
          ])
        }
      >
        + Add function
      </Button>
    </div>
  );
}
