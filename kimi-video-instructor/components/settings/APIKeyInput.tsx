'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onTest: (key: string) => Promise<boolean>;
  testStatus: TestStatus;
}

export function APIKeyInput({ value, onChange, onTest, testStatus }: APIKeyInputProps) {
  const [show, setShow] = useState(false);

  const handleTest = async () => {
    await onTest(value);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-or-v1-..."
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testStatus === 'loading' || !value.trim()}
        >
          {testStatus === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Test'
          )}
        </Button>
      </div>
      {testStatus === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Connection successful
        </div>
      )}
      {testStatus === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          Connection failed
        </div>
      )}
    </div>
  );
}
