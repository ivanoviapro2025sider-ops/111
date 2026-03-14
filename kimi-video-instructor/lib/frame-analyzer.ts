import { readFile } from 'fs/promises';
import { TranscriptSegment, ExtractedFrame, FrameAnalysis } from '@/types/pipeline';
import { ExtractedFrameInfo } from './video-processor';

export function alignFramesWithTranscript(
  frames: ExtractedFrameInfo[],
  transcript: TranscriptSegment[],
): ExtractedFrame[] {
  return frames.map((frame) => {
    const matchingSegments = transcript.filter(
      (seg) => seg.start <= frame.timestamp + 5 && seg.end >= frame.timestamp - 1,
    );

    return {
      id: `frame_${frame.index}`,
      index: frame.index,
      timestamp: frame.timestamp,
      timestampFormatted: frame.timestampFormatted,
      filePath: frame.filePath,
      thumbnailPath: frame.thumbnailPath,
      resolution: '',
      fileSize: frame.fileSize,
      sceneChangeScore: undefined,
      transcriptSegments: matchingSegments,
    };
  });
}

export async function frameToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

export function buildAnalysisBatch(
  frames: ExtractedFrame[],
  batchSize: number,
): ExtractedFrame[][] {
  const batches: ExtractedFrame[][] = [];
  for (let i = 0; i < frames.length; i += batchSize) {
    batches.push(frames.slice(i, i + batchSize));
  }
  return batches;
}

export function parseAnalysisResponse(responseText: string): FrameAnalysis[] {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.frames && Array.isArray(parsed.frames)) {
      return parsed.frames.map((f: Record<string, unknown>) => ({
        frameId: f.frameId || '',
        timestamp: f.timestamp || 0,
        description: f.description || '',
        userAction: f.userAction || '',
        uiElements: Array.isArray(f.uiElements) ? f.uiElements : [],
        isImportantStep: !!f.isImportantStep,
        suggestedStepTitle: f.suggestedStepTitle || undefined,
        suggestedAnnotations: Array.isArray(f.suggestedAnnotations)
          ? f.suggestedAnnotations
          : undefined,
      }));
    }
    return [];
  } catch {
    console.error('Failed to parse analysis response');
    return [];
  }
}
