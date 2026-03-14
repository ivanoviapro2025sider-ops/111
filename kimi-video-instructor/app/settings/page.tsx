'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { APIKeyInput } from '@/components/settings/APIKeyInput';
import { AgentSettings } from '@/components/settings/AgentSettings';
import { PipelineSettings } from '@/components/settings/PipelineSettings';
import { ExportSettings } from '@/components/settings/ExportSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlobalSettings, DEFAULT_AGENT_SETTINGS } from '@/types/agent';
import type { TestStatus } from '@/components/settings/APIKeyInput';

export default function SettingsPage() {
  const { settings, fetchSettings, saveSettings, testApiKey } = useSettingsStore();
  const [local, setLocal] = useState<GlobalSettings>(settings);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleTestKey = async (key: string): Promise<boolean> => {
    setTestStatus('loading');
    const ok = await testApiKey(key);
    setTestStatus(ok ? 'success' : 'error');
    return ok;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(local);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Tabs defaultValue="api">
        <TabsList className="mb-6">
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="ui">UI</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-6">
          <div className="space-y-2">
            <Label>OpenRouter API Key</Label>
            <APIKeyInput
              value={local.openrouterApiKey}
              onChange={(v) => setLocal((s) => ({ ...s, openrouterApiKey: v }))}
              onTest={handleTestKey}
              testStatus={testStatus}
            />
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={local.openrouterBaseUrl}
              onChange={(e) =>
                setLocal((s) => ({ ...s, openrouterBaseUrl: e.target.value }))
              }
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>
          <div className="space-y-2">
            <Label>Whisper Provider</Label>
            <Select
              value={local.whisperProvider}
              onValueChange={(v) =>
                setLocal((s) => ({
                  ...s,
                  whisperProvider: v as GlobalSettings['whisperProvider'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="agent">
          <AgentSettings
            value={local.agent}
            onChange={(updates) =>
              setLocal((s) => ({ ...s, agent: { ...s.agent, ...updates } }))
            }
            onReset={() =>
              setLocal((s) => ({
                ...s,
                agent: { ...DEFAULT_AGENT_SETTINGS },
              }))
            }
          />
        </TabsContent>

        <TabsContent value="video">
          <PipelineSettings
            value={{
              ...local.video,
              frameExtractionMethod: local.video.frameExtractionMethod as 'scene_detect' | 'fixed_interval' | 'transcript_aligned' | 'combined',
              whisperModel: local.video.whisperModel as 'tiny' | 'base' | 'small' | 'medium' | 'large-v3',
            }}
            onChange={(updates) =>
              setLocal((s) => ({ ...s, video: { ...s.video, ...updates } }))
            }
          />
        </TabsContent>

        <TabsContent value="instructions">
          <ExportSettings
            value={{
              instructionLanguage: local.instruction.defaultLanguage,
              instructionStyle: local.instruction.defaultStyle as 'step_by_step' | 'narrative' | 'technical' | 'simplified',
              includeTimestamps: local.instruction.includeTimestamps,
              includeTips: local.instruction.includeTips,
              includeWarnings: local.instruction.includeWarnings,
              annotateScreenshots: local.instruction.annotateScreenshots,
              theme: local.ui.theme,
            }}
            onChange={(updates) => {
              setLocal((s) => ({
                ...s,
                instruction: {
                  ...s.instruction,
                  ...('instructionLanguage' in updates && { defaultLanguage: updates.instructionLanguage }),
                  ...('instructionStyle' in updates && { defaultStyle: updates.instructionStyle }),
                  ...('includeTimestamps' in updates && { includeTimestamps: updates.includeTimestamps }),
                  ...('includeTips' in updates && { includeTips: updates.includeTips }),
                  ...('includeWarnings' in updates && { includeWarnings: updates.includeWarnings }),
                  ...('annotateScreenshots' in updates && { annotateScreenshots: updates.annotateScreenshots }),
                },
                ui:
                  'theme' in updates && updates.theme
                    ? { ...s.ui, theme: updates.theme }
                    : s.ui,
              }));
            }}
          />
        </TabsContent>

        <TabsContent value="ui" className="space-y-6">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={local.ui.theme}
              onValueChange={(v) =>
                setLocal((s) => ({
                  ...s,
                  ui: { ...s.ui, theme: v as GlobalSettings['ui']['theme'] },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Input
              value={local.ui.language}
              onChange={(e) =>
                setLocal((s) => ({
                  ...s,
                  ui: { ...s.ui, language: e.target.value },
                }))
              }
              placeholder="ru"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
