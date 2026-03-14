"use client";

interface HandoffConfiguratorProps {
  options: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function HandoffConfigurator({
  options,
  selected,
  onChange,
}: HandoffConfiguratorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-300">Handoff targets</p>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) => {
                if (event.target.checked) onChange([...selected, option.id]);
                else onChange(selected.filter((id) => id !== option.id));
              }}
            />
            {option.name}
          </label>
        ))}
      </div>
    </div>
  );
}
