"use client";

import { useState } from "react";
import { Eye, EyeOff, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onTestConnection: () => Promise<boolean>;
}

export function APIKeyInput({ value, onChange, onTestConnection }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const runTest = async () => {
    setTesting(true);
    try {
      const ok = await onTestConnection();
      setStatus(ok ? "ok" : "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-300">OpenRouter API Key</label>
      <div className="flex gap-2">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="sk-or-..."
        />
        <Button type="button" variant="outline" onClick={() => setVisible((prev) => !prev)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="secondary" disabled={testing} onClick={() => void runTest()}>
          <PlugZap className="mr-1 h-4 w-4" />
          {testing ? "Testing..." : "Test"}
        </Button>
      </div>
      {status !== "idle" ? (
        <p className={`text-xs ${status === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {status === "ok" ? "Connection successful" : "Connection failed"}
        </p>
      ) : null}
    </div>
  );
}
