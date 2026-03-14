'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjectStore } from '@/stores/projectStore';
import { PipelineStatus } from '@/components/pipeline/PipelineStatus';
import { InstructionEditor } from '@/components/editor/InstructionEditor';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDuration } from '@/lib/utils';
import { Play, LayoutList, FileEdit, Download } from 'lucide-react';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.id as string;
  const { currentProject, fetchProject } = useProjectStore();
  const { setInstruction } = useEditorStore();

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id, fetchProject]);

  useEffect(() => {
    if (currentProject?.instruction) {
      setInstruction(currentProject.instruction);
    }
    return () => setInstruction(null);
  }, [currentProject?.instruction, setInstruction]);

  const handleStartProcessing = async () => {
    const res = await fetch(`/api/projects/${id}/process`, { method: 'POST' });
    if (res.ok) router.push(`/projects/${id}/processing`);
    else fetchProject(id);
  };

  if (!currentProject || currentProject.id !== id) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const basePath = `/projects/${id}`;
  const tab = pathname === basePath ? 'overview' : pathname.split('/').pop() || 'overview';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{currentProject.name}</h1>
            <p className="text-sm text-muted-foreground">
              {currentProject.videoFileName} · {formatDuration(currentProject.videoDuration)}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">
            {currentProject.status}
          </span>
        </div>

        <Tabs value={tab}>
          <TabsList>
            <TabsTrigger value="overview" asChild>
              <Link href={basePath}>Overview</Link>
            </TabsTrigger>
            <TabsTrigger value="processing" asChild>
              <Link href={`${basePath}/processing`}>Processing</Link>
            </TabsTrigger>
            <TabsTrigger value="editor" asChild>
              <Link href={`${basePath}/editor`}>Editor</Link>
            </TabsTrigger>
            <TabsTrigger value="export" asChild>
              <Link href={`${basePath}/export`}>Export</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {currentProject.status === 'processing' && (
          <div className="space-y-4">
            <PipelineStatus pipeline={currentProject.pipelineState} />
          </div>
        )}

        {(currentProject.status === 'review' || currentProject.status === 'completed') && (
          <InstructionEditor />
        )}

        {currentProject.status === 'uploaded' && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <p className="mb-4 text-muted-foreground">
              Video uploaded. Start processing to generate instructions.
            </p>
            <Button onClick={handleStartProcessing}>
              <Play className="mr-2 h-4 w-4" />
              Start Processing
            </Button>
          </div>
        )}

        {currentProject.status === 'uploading' && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Upload in progress...
          </div>
        )}

        {currentProject.status === 'error' && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 py-16">
            <p className="mb-4 text-destructive">Processing failed.</p>
            <Button variant="outline" onClick={handleStartProcessing}>
              Retry Processing
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
