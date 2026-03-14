'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoUploader } from '@/components/project/VideoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectSettings, DEFAULT_PROJECT_SETTINGS } from '@/types/project';

const STYLES = [
  { value: 'step_by_step', label: 'Step by step' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'technical', label: 'Technical' },
  { value: 'simplified', label: 'Simplified' },
] as const;

const EXTRACTION_METHODS = [
  { value: 'scene_detect', label: 'Scene detection' },
  { value: 'fixed_interval', label: 'Fixed interval' },
  { value: 'transcript_aligned', label: 'Transcript aligned' },
  { value: 'combined', label: 'Combined' },
] as const;

const LANGUAGES = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Partial<ProjectSettings>>({
    ...DEFAULT_PROJECT_SETTINGS,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (_uploadId: string, _fileName: string, id?: string) => {
    if (id) setProjectId(id);
  };

  const handleSubmit = async () => {
    if (!projectId) {
      setError('Please upload a video first');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Untitled',
          description: description.trim() || undefined,
          settings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update project');
      }

      const processRes = await fetch(`/api/projects/${projectId}/process`, {
        method: 'POST',
      });
      if (processRes.ok) {
        router.push(`/projects/${projectId}/processing`);
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <h1 className="mb-8 text-2xl font-bold">New Project</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My video tutorial"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Video</Label>
          <VideoUploader
            projectName={name || undefined}
            projectDescription={description || undefined}
            onComplete={handleUploadComplete}
            onError={(e) => setError(e.message)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={settings.instructionLanguage ?? 'ru'}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, instructionLanguage: v }))
              }
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
            <Label>Style</Label>
            <Select
              value={settings.instructionStyle ?? 'step_by_step'}
              onValueChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  instructionStyle: v as ProjectSettings['instructionStyle'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Extraction method</Label>
            <Select
              value={settings.frameExtractionMethod ?? 'combined'}
              onValueChange={(v) =>
                setSettings((s) => ({
                  ...s,
                  frameExtractionMethod: v as ProjectSettings['frameExtractionMethod'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTRACTION_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max frames</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={settings.maxFrames ?? 200}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxFrames: parseInt(e.target.value) || 200,
                }))
              }
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Model</Label>
            <Input
              value={settings.kimiModel ?? 'moonshotai/kimi-k2'}
              onChange={(e) =>
                setSettings((s) => ({ ...s, kimiModel: e.target.value }))
              }
              placeholder="moonshotai/kimi-k2"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting || !projectId}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Creating...
            </span>
          ) : (
            'Upload and Start Processing'
          )}
        </Button>
      </div>
    </div>
  );
}
