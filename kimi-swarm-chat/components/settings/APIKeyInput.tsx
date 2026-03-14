"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function APIKeyInput({
  value,
  onChange,
  onTest,
}: {
  value: string;
  onChange: (value: string) => void;
  onTest: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">OpenRouter API key</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-or-..."
            className="pr-10"
          />
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-500"
            onClick={() => setShow((prev) => !prev)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button variant="secondary" onClick={onTest}>
          Test
        </Button>
      </div>
    </div>
  );
}
