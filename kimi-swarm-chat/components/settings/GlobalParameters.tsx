import type { GlobalSettings } from "@/lib/defaults";

interface GlobalParametersProps {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

export function GlobalParameters({ settings, onChange }: GlobalParametersProps) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Interface & defaults</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Theme
          <select
            value={settings.interface.theme}
            onChange={(event) =>
              onChange({
                ...settings,
                interface: {
                  ...settings.interface,
                  theme: event.target.value as GlobalSettings["interface"]["theme"],
                },
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className="text-sm text-zinc-300">
          Language
          <select
            value={settings.interface.language}
            onChange={(event) =>
              onChange({
                ...settings,
                interface: {
                  ...settings.interface,
                  language: event.target.value as GlobalSettings["interface"]["language"],
                },
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label className="text-sm text-zinc-300">
          File max size (bytes)
          <input
            type="number"
            value={settings.files.maxFileSize}
            onChange={(event) =>
              onChange({
                ...settings,
                files: {
                  ...settings.files,
                  maxFileSize: Number(event.target.value),
                },
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-300">
          Default chunk size
          <input
            type="number"
            value={settings.files.chunkSize}
            onChange={(event) =>
              onChange({
                ...settings,
                files: {
                  ...settings.files,
                  chunkSize: Number(event.target.value),
                },
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={settings.interface.showDebugInfo}
          onChange={(event) =>
            onChange({
              ...settings,
              interface: {
                ...settings.interface,
                showDebugInfo: event.target.checked,
              },
            })
          }
        />
        Show debug info by default
      </label>
    </section>
  );
}
