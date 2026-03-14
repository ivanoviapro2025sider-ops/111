'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onTest?: () => Promise<boolean>;
}

export default function APIKeyInput({ value, onChange, onTest }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
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
            className="pr-10"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <Button variant="outline" onClick={handleTest} disabled={testing || !value}>
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : testResult === true ? (
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
          ) : testResult === false ? (
            <XCircle className="h-4 w-4 text-red-500 mr-1" />
          ) : null}
          Test
        </Button>
      </div>
    </div>
  );
}
