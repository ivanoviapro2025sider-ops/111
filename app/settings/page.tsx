'use client';

import { useEffect, useState } from 'react';
import { APIKeyInput } from '@/components/settings/APIKeyInput';
import { GlobalParameters } from '@/components/settings/GlobalParameters';
import { ModelSelector } from '@/components/settings/ModelSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [models, setModels] = useState<Array<{ id: string; name?: string; pricing?: { prompt?: string; completion?: string }; context_length?: number }>>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [settingsResponse, modelsResponse] = await Promise.all([fetch('/api/settings', { cache: 'no-store' }), fetch('/api/openrouter/models', { cache: 'no-store' })]);
      const settingsData = await settingsResponse.json();
      const modelsData = await modelsResponse.json();
      setSettings(settingsData.settings ?? null);
      setModels(modelsData.models ?? []);
    };
    void load();
  }, []);

  if (!settings) return <div className="text-sm text-white/45">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">System configuration</div><h2 className="text-3xl font-semibold text-white">Глобальные настройки</h2></div>
      <Card className="space-y-5 p-6">
        <div>
          <div className="text-lg font-medium text-white">API configuration</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-white/70">OpenRouter API Key<div className="mt-2"><APIKeyInput value={settings.openRouterApiKey ?? ''} onChange={(openRouterApiKey) => setSettings({ ...settings, openRouterApiKey })} /></div></label>
            <label className="block text-sm text-white/70">Base URL<Input className="mt-2" value={settings.baseUrl ?? ''} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label>
            <label className="block text-sm text-white/70">HTTP-Referer<Input className="mt-2" value={settings.httpReferer ?? ''} onChange={(event) => setSettings({ ...settings, httpReferer: event.target.value })} /></label>
            <label className="block text-sm text-white/70">X-Title<Input className="mt-2" value={settings.xTitle ?? ''} onChange={(event) => setSettings({ ...settings, xTitle: event.target.value })} /></label>
          </div>
        </div>
        <div><div className="text-lg font-medium text-white">Default model</div><div className="mt-4"><ModelSelector value={settings.defaultModel} models={models} onChange={(defaultModel) => setSettings({ ...settings, defaultModel })} /></div></div>
        <div><div className="mb-4 text-lg font-medium text-white">Global parameters</div><GlobalParameters value={settings} onChange={(patch) => setSettings({ ...settings, ...patch })} /></div>
        <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm text-white/70">Interface language<select className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white" value={settings.language} onChange={(event) => setSettings({ ...settings, language: event.target.value })}><option value="ru">RU</option><option value="en">EN</option></select></label><label className="block text-sm text-white/70">Theme<select className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white" value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label></div>
        <div className="flex items-center gap-3"><Button onClick={async () => { const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); setStatus(response.ok ? 'Settings saved' : 'Failed to save'); }}>Save settings</Button><Button variant="secondary" onClick={async () => { const response = await fetch('/api/openrouter/models', { cache: 'no-store' }); setStatus(response.ok ? 'Connection OK' : 'Connection failed'); }}>Test connection</Button>{status ? <div className="text-sm text-white/50">{status}</div> : null}</div>
      </Card>
    </div>
  );
}
