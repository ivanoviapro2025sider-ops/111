'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Check } from 'lucide-react';
import { OpenRouterModel } from '@/types/openrouter';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  apiKey?: string;
}

export function ModelSelector({ value, onChange, apiKey }: ModelSelectorProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const url = apiKey ? `/api/openrouter/models?apiKey=${encodeURIComponent(apiKey)}` : '/api/openrouter/models';
      const res = await fetch(url);
      const data = await res.json();
      if (data.models) setModels(data.models);
    } catch (e) {
      console.error('Failed to fetch models:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [apiKey]);

  const filtered = models.filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.name?.toLowerCase().includes(search.toLowerCase())
  );

  const kimiModels = filtered.filter((m) => m.id.includes('kimi') || m.id.includes('moonshot'));
  const otherModels = filtered.filter((m) => !m.id.includes('kimi') && !m.id.includes('moonshot'));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Default Model</Label>
        <Button variant="ghost" size="sm" onClick={fetchModels} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="pl-8"
        />
      </div>

      <ScrollArea className="h-64 rounded-md border">
        <div className="p-2 space-y-1">
          {kimiModels.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">KIMI / Moonshot</p>
              {kimiModels.map((model) => (
                <ModelItem key={model.id} model={model} selected={value === model.id} onClick={() => onChange(model.id)} />
              ))}
            </>
          )}
          {otherModels.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 mt-2">Other Models</p>
              {otherModels.map((model) => (
                <ModelItem key={model.id} model={model} selected={value === model.id} onClick={() => onChange(model.id)} />
              ))}
            </>
          )}
          {filtered.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">No models found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ModelItem({ model, selected, onClick }: { model: OpenRouterModel; selected: boolean; onClick: () => void }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
        selected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent'
      }`}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{model.name || model.id}</span>
          {selected && <Check className="h-3 w-3 text-primary shrink-0" />}
        </div>
        <span className="text-[10px] text-muted-foreground">{model.id}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
        {model.pricing && (
          <span className="text-[10px] text-muted-foreground">
            ${parseFloat(model.pricing.prompt || '0').toFixed(2)}/1M
          </span>
        )}
        {model.context_length && (
          <Badge variant="outline" className="text-[8px] px-1 py-0">
            {(model.context_length / 1000).toFixed(0)}k ctx
          </Badge>
        )}
      </div>
    </div>
  );
}
