'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelSelector } from './ModelSelector';
import type { AgentSettings } from '@/types/agent';

interface AgentSettingsProps {
  value: AgentSettings;
  onChange: (updates: Partial<AgentSettings>) => void;
  onReset?: () => void;
}

export function AgentSettings({ value, onChange, onReset }: AgentSettingsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agent / LLM</CardTitle>
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset to defaults
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Analysis model</Label>
          <ModelSelector
            value={value.kimiModel}
            onChange={(v) => onChange({ kimiModel: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Thinking model</Label>
          <ModelSelector
            value={value.thinkingModel}
            onChange={(v) => onChange({ thinkingModel: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>Temperature</Label>
          <Slider
            value={[value.temperature]}
            onValueChange={([v]) => onChange({ temperature: v })}
            min={0}
            max={2}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">{value.temperature}</p>
        </div>

        <div className="space-y-2">
          <Label>Top P</Label>
          <Slider
            value={[value.topP]}
            onValueChange={([v]) => onChange({ topP: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-muted-foreground">{value.topP}</p>
        </div>

        <div className="space-y-2">
          <Label>Max tokens</Label>
          <Input
            type="number"
            min={256}
            max={131072}
            value={value.maxTokens}
            onChange={(e) =>
              onChange({ maxTokens: parseInt(e.target.value) || 8192 })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Frequency penalty</Label>
          <Slider
            value={[value.frequencyPenalty]}
            onValueChange={([v]) => onChange({ frequencyPenalty: v })}
            min={-2}
            max={2}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            {value.frequencyPenalty}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Presence penalty</Label>
          <Slider
            value={[value.presencePenalty]}
            onValueChange={([v]) => onChange({ presencePenalty: v })}
            min={-2}
            max={2}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">{value.presencePenalty}</p>
        </div>

        <div className="space-y-2">
          <Label>Frames per batch</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={value.framesPerBatch}
            onChange={(e) =>
              onChange({ framesPerBatch: parseInt(e.target.value) || 5 })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Batch delay (ms)</Label>
          <Input
            type="number"
            min={0}
            max={10000}
            value={value.batchDelay}
            onChange={(e) =>
              onChange({ batchDelay: parseInt(e.target.value) || 1000 })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Analysis prompt</Label>
          <Textarea
            value={value.analysisPrompt}
            onChange={(e) => onChange({ analysisPrompt: e.target.value })}
            className="font-mono min-h-[200px] text-sm"
            placeholder="Analysis prompt..."
          />
        </div>

        <div className="space-y-2">
          <Label>Generation prompt</Label>
          <Textarea
            value={value.generationPrompt}
            onChange={(e) => onChange({ generationPrompt: e.target.value })}
            className="font-mono min-h-[200px] text-sm"
            placeholder="Generation prompt..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
