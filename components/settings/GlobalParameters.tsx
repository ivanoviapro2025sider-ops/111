'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/stores/settingsStore';

export default function GlobalParameters() {
  const {
    theme, setTheme,
    language, setLanguage,
    fontSize, setFontSize,
    debugMode, setDebugMode,
    maxFileSize, setMaxFileSize,
    defaultChunkSize, setDefaultChunkSize,
    defaultProcessingStrategy, setDefaultProcessingStrategy,
    baseUrl, setBaseUrl,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">Interface</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
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
            <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ru')}>
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
            <Label>Font Size ({fontSize}px)</Label>
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
              min={10}
              max={24}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Debug Mode</Label>
            <Switch checked={debugMode} onCheckedChange={setDebugMode} />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold mb-4">File Processing</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Max File Size (bytes)</Label>
            <Input
              type="number"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Chunk Size (characters)</Label>
            <Input
              type="number"
              value={defaultChunkSize}
              onChange={(e) => setDefaultChunkSize(parseInt(e.target.value) || 4000)}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Processing Strategy</Label>
            <Select
              value={defaultProcessingStrategy}
              onValueChange={(v) =>
                setDefaultProcessingStrategy(v as 'full' | 'chunked' | 'summary' | 'map-reduce')
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
      </div>
    </div>
  );
}
