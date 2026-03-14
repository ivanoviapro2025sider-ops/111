'use client';

import { useSettingsStore } from '@/stores/settingsStore';
import { APIKeyInput } from '@/components/settings/APIKeyInput';
import { ModelSelector } from '@/components/settings/ModelSelector';
import { ParameterSlider } from '@/components/settings/GlobalParameters';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const settings = useSettingsStore();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-muted-foreground text-sm">Configure your KIMI Swarm Chat service</p>
      </div>

      {/* API Configuration */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">API Configuration</h3>
        <Separator />

        <APIKeyInput
          value={settings.apiKey}
          onChange={settings.setApiKey}
          baseUrl={settings.baseUrl}
        />

        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            value={settings.baseUrl}
            onChange={(e) => settings.setBaseUrl(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>HTTP-Referer</Label>
            <Input
              value={settings.httpReferer}
              onChange={(e) => settings.updateSettings({ httpReferer: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>X-Title</Label>
            <Input
              value={settings.xTitle}
              onChange={(e) => settings.updateSettings({ xTitle: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              value={settings.timeout}
              onChange={(e) => settings.updateSettings({ timeout: parseInt(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Retry Count</Label>
            <Input
              type="number"
              value={settings.retryCount}
              onChange={(e) => settings.updateSettings({ retryCount: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {/* Default Model Settings */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Default Model Settings</h3>
        <Separator />

        <ModelSelector
          value={settings.defaultModel}
          onChange={settings.setDefaultModel}
          apiKey={settings.apiKey}
        />
      </section>

      {/* Swarm Defaults */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Swarm Defaults</h3>
        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Max Turns</Label>
            <Input
              type="number"
              value={settings.defaultMaxTurns}
              onChange={(e) => settings.updateSettings({ defaultMaxTurns: parseInt(e.target.value) })}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>Debug Mode by Default</Label>
            <Switch
              checked={settings.defaultDebugMode}
              onCheckedChange={(v) => settings.updateSettings({ defaultDebugMode: v })}
            />
          </div>
        </div>
      </section>

      {/* File Processing */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">File Processing</h3>
        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Max File Size (bytes)</Label>
            <Input
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => settings.updateSettings({ maxFileSize: parseInt(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Current: {(settings.maxFileSize / (1024 * 1024 * 1024)).toFixed(1)} GB
            </p>
          </div>
          <div className="space-y-2">
            <Label>Default Processing Strategy</Label>
            <Select
              value={settings.defaultProcessingStrategy}
              onValueChange={(v) =>
                settings.updateSettings({
                  defaultProcessingStrategy: v as 'full' | 'chunked' | 'summary' | 'map-reduce',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="chunked">Chunked</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="map-reduce">Map-Reduce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Default Chunk Size (chars)</Label>
          <Input
            type="number"
            value={settings.defaultChunkSize}
            onChange={(e) => settings.updateSettings({ defaultChunkSize: parseInt(e.target.value) })}
          />
        </div>
      </section>

      {/* Interface */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Interface</h3>
        <Separator />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={(v) => settings.setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={settings.language} onValueChange={(v) => settings.setLanguage(v as 'ru' | 'en')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Input
              type="number"
              value={settings.fontSize}
              onChange={(e) => settings.setFontSize(parseInt(e.target.value))}
              min={10}
              max={24}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label>Show Debug Info by Default</Label>
          <Switch
            checked={settings.showDebugInfo}
            onCheckedChange={settings.setShowDebugInfo}
          />
        </div>
      </section>
    </div>
  );
}
