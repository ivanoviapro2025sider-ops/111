import type { AgentFunction } from "@/types/agent";

interface FunctionEditorProps {
  value: AgentFunction[];
  onChange: (value: AgentFunction[]) => void;
}

export function FunctionEditor({ value, onChange }: FunctionEditorProps) {
  const update = (index: number, patch: Partial<AgentFunction>) => {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Functions / Tools</h3>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...value,
              {
                name: "new_function",
                description: "",
                parameters: { type: "object", properties: {} },
                implementation: "return { ok: true };",
                isHandoff: false,
              },
            ])
          }
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
        >
          + Add Function
        </button>
      </div>

      {value.map((fn, index) => (
        <div key={`${fn.name}-${index}`} className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs text-zinc-300">
              Name
              <input
                value={fn.name}
                onChange={(event) => update(index, { name: event.target.value })}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-zinc-300">
              Description
              <input
                value={fn.description}
                onChange={(event) => update(index, { description: event.target.value })}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <label className="text-xs text-zinc-300">
            Parameters (JSON Schema)
            <textarea
              value={JSON.stringify(fn.parameters, null, 2)}
              onChange={(event) => {
                try {
                  update(index, { parameters: JSON.parse(event.target.value) });
                } catch {
                  // Keep current JSON while user edits.
                }
              }}
              className="mt-1 min-h-24 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
            />
          </label>
          <label className="text-xs text-zinc-300">
            Implementation (JavaScript)
            <textarea
              value={fn.implementation}
              onChange={(event) => update(index, { implementation: event.target.value })}
              className="mt-1 min-h-24 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={fn.isHandoff}
              onChange={(event) => update(index, { isHandoff: event.target.checked })}
            />
            Handoff function
          </label>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            className="text-xs text-red-300"
          >
            Remove function
          </button>
        </div>
      ))}
    </section>
  );
}
