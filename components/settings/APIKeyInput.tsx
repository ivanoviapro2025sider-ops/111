'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  baseUrl: string;
}

export function APIKeyInput({ value, onChange, baseUrl }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/openrouter/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: value, baseUrl }),
      });
      const data = await res.json();
      setTestResult(data.success);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>OpenRouter API Key</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-or-..."
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
        <Button variant="outline" onClick={handleTest} disabled={!value || testing} className="gap-1">
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : testResult === true ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : testResult === false ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : null}
          Test
        </Button>
      </div>
    </div>
  );
}
