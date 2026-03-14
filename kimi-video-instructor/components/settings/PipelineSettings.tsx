'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectSettings } from '@/types/project';

interface PipelineSettingsProps {
  value: Pick<
    ProjectSettings,
    | 'frameExtractionMethod'
    | 'fixedIntervalSeconds'
    | 'sceneChangeThreshold'
    | 'maxFrames'
    | 'frameQuality'
    | 'frameResolution'
    | 'whisperModel'
    | 'whisperLanguage'
  >;
  onChange: (updates: Partial<PipelineSettingsProps['value']>) => void;
}

const FRAME_METHODS = [
  { value: 'scene_detect', label: 'Scene detection' },
  { value: 'fixed_interval', label: 'Fixed interval' },
  { value: 'transcript_aligned', label: 'Transcript aligned' },
  { value: 'combined', label: 'Combined' },
] as const;

const RESOLUTIONS = ['1920x1080', '1280x720', '854x480', '640x360'];

const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3'] as const;

const LANGUAGES = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

export function PipelineSettings({ value, onChange }: PipelineSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline / Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Frame extraction method</Label>
          <RadioGroup
            value={value.frameExtractionMethod}
            onValueChange={(v) =>
              onChange({
                frameExtractionMethod: v as ProjectSettings['frameExtractionMethod'],
              })
            }
            className="flex flex-col gap-2"
          >
            {FRAME_METHODS.map((m) => (
              <div key={m.value} className="flex items-center space-x-2">
                <RadioGroupItem value={m.value} id={m.value} />
                <Label htmlFor={m.value} className="font-normal">
                  {m.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Interval (seconds)</Label>
          <Slider
            value={[value.fixedIntervalSeconds]}
            onValueChange={([v]) => onChange({ fixedIntervalSeconds: v })}
            min={1}
            max={30}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            {value.fixedIntervalSeconds}s
          </p>
        </div>

        <div className="space-y-2">
          <Label>Scene change threshold</Label>
          <Slider
            value={[value.sceneChangeThreshold]}
            onValueChange={([v]) => onChange({ sceneChangeThreshold: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-muted-foreground">
            {value.sceneChangeThreshold}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Max frames</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={value.maxFrames}
            onChange={(e) =>
              onChange({ maxFrames: parseInt(e.target.value) || 200 })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Frame quality</Label>
          <Slider
            value={[value.frameQuality]}
            onValueChange={([v]) => onChange({ frameQuality: v })}
            min={1}
            max={100}
            step={1}
          />
          <p className="text-xs text-muted-foreground">{value.frameQuality}%</p>
        </div>

        <div className="space-y-2">
          <Label>Resolution</Label>
          <Select
            value={value.frameResolution}
            onValueChange={(v) => onChange({ frameResolution: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Whisper model</Label>
          <Select
            value={value.whisperModel}
            onValueChange={(v) =>
              onChange({ whisperModel: v as ProjectSettings['whisperModel'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WHISPER_MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select
            value={value.whisperLanguage}
            onValueChange={(v) => onChange({ whisperLanguage: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
