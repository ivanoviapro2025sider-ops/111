"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function APIKeyInput({ value, onChange }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">OpenRouter API Key</label>
      <div className="flex gap-2">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="sk-or-..."
        />
        <Button type="button" variant="secondary" size="icon" onClick={() => setVisible((x) => !x)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
