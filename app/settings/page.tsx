'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, TestTube2, CheckCircle2, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/openrouter/models');
      if (res.ok) {
        const data = await res.json();
        setModels((data.data || []).slice(0, 100));
      }
    } catch {
      // Models fetch may fail without API key
    }
  };

  const testConnection = async () => {
    setTestResult('testing');
    try {
      const res = await fetch('/api/openrouter/models');
      setTestResult(res.ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    }
    setTimeout(() => setTestResult('idle'), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    await settings.saveSettings();
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Configure API, models, and interface preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Configuration</CardTitle>
          <CardDescription>Configure your OpenRouter API connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>OpenRouter API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => settings.setApiKey(e.target.value)}
                  placeholder="sk-or-..."
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={testConnection} disabled={testResult === 'testing'}>
                {testResult === 'testing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : testResult === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : testResult === 'error' ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <TestTube2 className="w-4 h-4" />
                )}
                <span className="ml-1">Test</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={settings.baseUrl}
              onChange={(e) => settings.setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Model</CardTitle>
          <CardDescription>Choose the default model for new agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={settings.defaultModel}
              onValueChange={(v) => settings.setDefaultModel(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moonshotai/kimi-k2">moonshotai/kimi-k2</SelectItem>
                <SelectItem value="moonshotai/kimi-k2-thinking">moonshotai/kimi-k2-thinking</SelectItem>
                {models
                  .filter(m => !m.id.startsWith('moonshotai/'))
                  .map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Badge variant="secondary">KIMI K2</Badge>
              <Badge variant="outline" className="text-xs">1T params, MoE, 32B active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">File Processing</CardTitle>
          <CardDescription>Configure default file handling behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Strategy</Label>
            <Select
              value={settings.defaultStrategy}
              onValueChange={(v) => settings.setDefaultStrategy(v as typeof settings.defaultStrategy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Text</SelectItem>
                <SelectItem value="chunked">Chunked</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="map-reduce">Map-Reduce</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Chunk Size (characters)</Label>
            <Input
              type="number"
              value={settings.defaultChunkSize}
              onChange={(e) => settings.setDefaultChunkSize(parseInt(e.target.value) || 4000)}
              min={500}
              max={32000}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interface</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(v) => settings.setTheme(v as 'light' | 'dark' | 'system')}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label>Language</Label>
            <Select
              value={settings.language}
              onValueChange={(v) => settings.setLanguage(v as 'en' | 'ru')}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label>Font Size</Label>
            <Input
              type="number"
              value={settings.fontSize}
              onChange={(e) => settings.setFontSize(parseInt(e.target.value) || 14)}
              className="w-20"
              min={10}
              max={24}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Show Debug Info</Label>
              <p className="text-xs text-muted-foreground">Display tool calls, tokens, and model info</p>
            </div>
            <Switch
              checked={settings.showDebug}
              onCheckedChange={settings.setShowDebug}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
