'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';
import { InstructionPreview } from '@/components/editor/InstructionPreview';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download } from 'lucide-react';

type ExportFormat = 'md' | 'html' | 'pdf' | 'docx' | 'all';

export default function ExportPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentProject, fetchProject } = useProjectStore();
  const [format, setFormat] = useState<ExportFormat>('md');
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeTips, setIncludeTips] = useState(true);
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id, fetchProject]);

  const handleExport = async () => {
    if (!currentProject?.instruction) return;
    setExporting(true);
    try {
      const formats = format === 'all' ? ['md', 'html'] : [format];
      for (const f of formats) {
        const res = await fetch(`/api/projects/${id}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: f,
            includeScreenshots,
            includeAnnotations,
            includeTimestamps,
            includeTips,
            includeTableOfContents,
            includeMetadata,
          }),
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instruction.${f === 'html' ? 'html' : 'md'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (!currentProject || currentProject.id !== id) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!currentProject.instruction) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
        <p>No instruction generated yet. Complete processing first.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
      <div className="space-y-6">
        <div>
          <h2 className="mb-4 font-semibold">Export Format</h2>
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <div className="space-y-2">
              {[
                { value: 'md' as const, label: 'Markdown' },
                { value: 'html' as const, label: 'HTML' },
                { value: 'pdf' as const, label: 'PDF' },
                { value: 'docx' as const, label: 'DOCX' },
                { value: 'all' as const, label: 'All' },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div>
          <h2 className="mb-4 font-semibold">Options</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="screenshots"
                checked={includeScreenshots}
                onCheckedChange={(c) => setIncludeScreenshots(!!c)}
              />
              <Label htmlFor="screenshots" className="font-normal">
                Include screenshots
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="annotations"
                checked={includeAnnotations}
                onCheckedChange={(c) => setIncludeAnnotations(!!c)}
              />
              <Label htmlFor="annotations" className="font-normal">
                Include annotations
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="timestamps"
                checked={includeTimestamps}
                onCheckedChange={(c) => setIncludeTimestamps(!!c)}
              />
              <Label htmlFor="timestamps" className="font-normal">
                Include timestamps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tips"
                checked={includeTips}
                onCheckedChange={(c) => setIncludeTips(!!c)}
              />
              <Label htmlFor="tips" className="font-normal">
                Include tips
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="toc"
                checked={includeTableOfContents}
                onCheckedChange={(c) => setIncludeTableOfContents(!!c)}
              />
              <Label htmlFor="toc" className="font-normal">
                Table of contents
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={(c) => setIncludeMetadata(!!c)}
              />
              <Label htmlFor="metadata" className="font-normal">
                Metadata
              </Label>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Exporting...
            </span>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/30">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <InstructionPreview instruction={currentProject.instruction} className="p-6" />
        </ScrollArea>
      </div>
    </div>
  );
}
