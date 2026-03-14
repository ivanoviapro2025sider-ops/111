"use client";

import { useState } from "react";

interface APIKeyInputProps {
  value: string;
  baseUrl: string;
  onChange: (value: string) => void;
}

export function APIKeyInput({ value, baseUrl, onChange }: APIKeyInputProps) {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">API Configuration</h2>
      <label className="block text-sm text-zinc-300">
        OpenRouter API Key
        <div className="mt-1 flex gap-2">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="sk-or-..."
          />
          <button
            type="button"
            onClick={() => setShow((current) => !current)}
            className="rounded-md border border-zinc-700 px-2 text-xs text-zinc-300"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      <p className="text-xs text-zinc-500">Base URL: {baseUrl}</p>
      <button
        type="button"
        onClick={async () => {
          setStatus("Testing...");
          const response = await fetch("/api/openrouter/models");
          setStatus(response.ok ? "Connection OK" : "Connection failed");
        }}
        className="rounded-md border border-indigo-600 px-3 py-1 text-xs text-indigo-200"
      >
        Test Connection
      </button>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </section>
  );
}
