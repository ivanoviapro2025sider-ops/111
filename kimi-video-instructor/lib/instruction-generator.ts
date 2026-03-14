import { v4 as uuidv4 } from 'uuid';
import { Instruction, InstructionStep } from '@/types/instruction';
import { ExtractedFrame, FrameAnalysis } from '@/types/pipeline';
import { GeneratedInstruction } from './kimi-agent';
import { formatDuration } from './utils';

export function buildInstruction(
  generated: GeneratedInstruction,
  frames: ExtractedFrame[],
  videoFileName: string,
  videoDuration: number,
  model: string,
  language: string,
): Instruction {
  const frameMap = new Map(frames.map((f) => [f.id, f]));

  const steps: InstructionStep[] = generated.steps.map((step) => {
    const frame = frameMap.get(step.frameId);

    return {
      id: uuidv4(),
      order: step.order,
      title: step.title,
      description: step.description,
      screenshot: {
        path: frame?.filePath || '',
        annotations: [],
        caption: step.title,
      },
      timestamp: frame?.timestamp || 0,
      timestampFormatted: frame?.timestampFormatted || '00m00s',
      tips: step.tips || [],
      warnings: step.warnings || [],
      notes: undefined,
      isManuallyEdited: false,
    };
  });

  const readTimeMinutes = Math.max(1, Math.ceil(steps.length * 0.5));

  return {
    id: uuidv4(),
    title: generated.title,
    description: generated.description,
    totalSteps: steps.length,
    estimatedReadTime: readTimeMinutes,
    steps,
    metadata: {
      sourceVideo: videoFileName,
      videoDuration,
      generatedAt: new Date().toISOString(),
      model,
      language,
    },
  };
}
