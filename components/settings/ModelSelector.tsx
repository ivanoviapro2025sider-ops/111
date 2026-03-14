'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import type { OpenRouterModel } from '@/types/openrouter';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/openrouter/models');
        if (res.ok) {
          const data = await res.json();
          setModels(data.data || []);
        }
      } catch {
        // Use fallback models
        setModels([
          { id: 'moonshotai/kimi-k2', name: 'KIMI K2', pricing: { prompt: '0.0000006', completion: '0.0000006' }, context_length: 131072 },
          { id: 'moonshotai/kimi-k2-thinking', name: 'KIMI K2 Thinking', pricing: { prompt: '0.0000006', completion: '0.0000006' }, context_length: 131072 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  const filtered = models.filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Label>Default Model</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[300px] rounded-md border">
          <div className="p-2 space-y-1">
            {filtered.map((model) => (
              <div
                key={model.id}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  value === model.id
                    ? 'bg-primary/10 border border-primary'
                    : 'hover:bg-accent border border-transparent'
                }`}
                onClick={() => onChange(model.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{model.id}</span>
                  <Badge variant="outline" className="text-xs">
                    {model.context_length ? `${(model.context_length / 1024).toFixed(0)}K ctx` : ''}
                  </Badge>
                </div>
                {model.pricing && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/1M input —{' '}
                    ${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}/1M output
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="text-sm text-muted-foreground">
        Selected: <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}
