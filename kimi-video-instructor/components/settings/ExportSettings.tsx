'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { GlobalSettings } from '@/types/agent';

interface ExportSettingsProps {
  value: Pick<
    ProjectSettings,
    | 'instructionLanguage'
    | 'instructionStyle'
    | 'includeTimestamps'
    | 'includeTips'
    | 'includeWarnings'
    | 'annotateScreenshots'
  > & {
    theme?: GlobalSettings['ui']['theme'];
  };
  onChange: (updates: Partial<ExportSettingsProps['value']>) => void;
}

const STYLES = [
  { value: 'step_by_step', label: 'Step by step' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'technical', label: 'Technical' },
  { value: 'simplified', label: 'Simplified' },
] as const;

const LANGUAGES = [
  { value: 'ru', label: 'Russian' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

export function ExportSettings({ value, onChange }: ExportSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export / Instruction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Default language</Label>
          <Select
            value={value.instructionLanguage}
            onValueChange={(v) => onChange({ instructionLanguage: v })}
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

        <div className="space-y-2">
          <Label>Default style</Label>
          <RadioGroup
            value={value.instructionStyle}
            onValueChange={(v) =>
              onChange({
                instructionStyle: v as ProjectSettings['instructionStyle'],
              })
            }
            className="flex flex-col gap-2"
          >
            {STYLES.map((s) => (
              <div key={s.value} className="flex items-center space-x-2">
                <RadioGroupItem value={s.value} id={s.value} />
                <Label htmlFor={s.value} className="font-normal">
                  {s.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label>Options</Label>
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="timestamps"
                checked={value.includeTimestamps}
                onCheckedChange={(c) =>
                  onChange({ includeTimestamps: !!c })
                }
              />
              <Label htmlFor="timestamps" className="font-normal">
                Include timestamps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tips"
                checked={value.includeTips}
                onCheckedChange={(c) => onChange({ includeTips: !!c })}
              />
              <Label htmlFor="tips" className="font-normal">
                Include tips
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="warnings"
                checked={value.includeWarnings}
                onCheckedChange={(c) =>
                  onChange({ includeWarnings: !!c })
                }
              />
              <Label htmlFor="warnings" className="font-normal">
                Include warnings
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="annotations"
                checked={value.annotateScreenshots}
                onCheckedChange={(c) =>
                  onChange({ annotateScreenshots: !!c })
                }
              />
              <Label htmlFor="annotations" className="font-normal">
                Annotate screenshots
              </Label>
            </div>
          </div>
        </div>

        {value.theme !== undefined && (
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={value.theme}
              onValueChange={(v) =>
                onChange({
                  theme: v as GlobalSettings['ui']['theme'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
