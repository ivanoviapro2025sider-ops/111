'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function APIKeyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-3">
      <Input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} />
      <Button type="button" variant="secondary" onClick={() => setVisible((state) => !state)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
    </div>
  );
}
