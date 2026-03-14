export type PipelineStage =
  | 'upload'
  | 'extractAudio'
  | 'transcribe'
  | 'extractFrames'
  | 'align'
  | 'analyze'
  | 'generate';

export type StageStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface StageState {
  status: StageStatus;
  progress: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
}

export interface PipelineState {
  currentStage: PipelineStage;
  stages: Record<PipelineStage, StageState>;
  startedAt?: string;
  completedAt?: string;
  error?: { stage: PipelineStage; message: string; details?: string };
}

export interface TranscriptSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
  words?: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface ExtractedFrame {
  id: string;
  index: number;
  timestamp: number;
  timestampFormatted: string;
  filePath: string;
  thumbnailPath: string;
  resolution: string;
  fileSize: number;
  sceneChangeScore?: number;
  transcriptSegments: TranscriptSegment[];
}

export interface FrameAnalysis {
  frameId: string;
  timestamp: number;
  description: string;
  userAction: string;
  uiElements: string[];
  isImportantStep: boolean;
  suggestedStepTitle?: string;
  suggestedAnnotations?: Annotation[];
}

export interface Annotation {
  type: 'arrow' | 'rectangle' | 'circle' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  toX?: number;
  toY?: number;
  label?: string;
  color: string;
}

export const PIPELINE_STAGES_ORDER: PipelineStage[] = [
  'upload',
  'extractAudio',
  'transcribe',
  'extractFrames',
  'align',
  'analyze',
  'generate',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  upload: 'Загрузка видео',
  extractAudio: 'Извлечение аудио',
  transcribe: 'Транскрипция',
  extractFrames: 'Извлечение кадров',
  align: 'Сопоставление',
  analyze: 'Анализ KIMI',
  generate: 'Генерация инструкции',
};

export function createInitialPipelineState(): PipelineState {
  const stages = {} as Record<PipelineStage, StageState>;
  for (const stage of PIPELINE_STAGES_ORDER) {
    stages[stage] = { status: 'pending', progress: 0 };
  }
  return {
    currentStage: 'upload',
    stages,
  };
}
