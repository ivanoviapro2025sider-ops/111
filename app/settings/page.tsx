'use client';

import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import APIKeyInput from '@/components/settings/APIKeyInput';
import ModelSelector from '@/components/settings/ModelSelector';
import GlobalParameters from '@/components/settings/GlobalParameters';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const {
    apiKey,
    setApiKey,
    defaultModel,
    setDefaultModel,
    saveSettings,
  } = useSettingsStore();

  const handleTestConnection = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/openrouter/models');
      return res.ok;
    } catch {
      return false;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your KIMI Swarm Chat service</p>
        </div>
        <Button onClick={saveSettings}>
          <Save className="h-4 w-4 mr-2" />
          Save All
        </Button>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
          <div className="space-y-4 bg-card border border-border rounded-xl p-6">
            <APIKeyInput
              value={apiKey}
              onChange={setApiKey}
              onTest={handleTestConnection}
            />
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-xl font-semibold mb-4">Default Model</h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <ModelSelector value={defaultModel} onChange={setDefaultModel} />
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-xl font-semibold mb-4">Global Settings</h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <GlobalParameters />
          </div>
        </section>
      </div>
    </div>
  );
}
