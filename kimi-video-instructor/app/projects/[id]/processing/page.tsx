'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';
import { PipelineStatus } from '@/components/pipeline/PipelineStatus';
import { FrameGallery } from '@/components/pipeline/FrameGallery';
import { TranscriptViewer } from '@/components/pipeline/TranscriptViewer';
import { PipelineState } from '@/types/pipeline';
import { ExtractedFrame } from '@/types/pipeline';
import { TranscriptSegment } from '@/types/pipeline';

export default function ProcessingPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentProject, fetchProject } = useProjectStore();
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setPipelineState(data.pipelineState || null);
      if (['review', 'completed', 'error'].includes(data.status)) {
        fetchProject(id);
      }
    } catch {}
  }, [id, fetchProject]);

  useEffect(() => {
    fetchProject(id);
  }, [id, fetchProject]);

  useEffect(() => {
    if (!id || !['uploading', 'uploaded', 'processing'].includes(status || '')) return;
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [id, status, pollStatus]);

  useEffect(() => {
    if (currentProject?.id === id) {
      setStatus(currentProject.status);
      setPipelineState(currentProject.pipelineState || null);
    }
  }, [currentProject, id]);

  const project = currentProject?.id === id ? currentProject : null;
  const pipeline = pipelineState || project?.pipelineState;

  const frames: { id: string; filePath: string; thumbnailPath: string; timestampFormatted: string }[] = [];
  if (pipeline?.stages?.extractFrames?.result?.frames) {
    const extracted = pipeline.stages.extractFrames.result.frames as ExtractedFrame[];
    frames.push(
      ...extracted.map((f) => ({
        id: f.id,
        filePath: f.filePath,
        thumbnailPath: f.thumbnailPath || f.filePath,
        timestampFormatted: f.timestampFormatted,
      }))
    );
  }

  const transcriptSegments: { id: number; text: string; start: number; end: number }[] = [];
  const transcribeResult = pipeline?.stages?.transcribe?.result;
  if (transcribeResult?.segments) {
    const segs = transcribeResult.segments as TranscriptSegment[];
    transcriptSegments.push(
      ...segs.map((s) => ({ id: s.id, text: s.text, start: s.start, end: s.end }))
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <h1 className="text-2xl font-bold">Processing</h1>

      {pipeline && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Pipeline Status</h2>
          <PipelineStatus pipeline={pipeline} />
        </div>
      )}

      {frames.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Extracted Frames</h2>
          <FrameGallery frames={frames} />
        </div>
      )}

      {transcriptSegments.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Transcript</h2>
          <TranscriptViewer segments={transcriptSegments} />
        </div>
      )}

      {!pipeline && !project && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
