export type ProjectStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'review'
  | 'completed'
  | 'error';

export interface ProjectSettings {
  frameExtractionMethod: 'scene_detect' | 'fixed_interval' | 'transcript_aligned' | 'combined';
  fixedIntervalSeconds: number;
  sceneChangeThreshold: number;
  maxFrames: number;
  frameQuality: number;
  frameResolution: string;

  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  whisperLanguage: string;

  kimiModel: string;
  framesPerBatch: number;
  analysisPrompt: string;
  generationPrompt: string;
  temperature: number;
  maxTokens: number;

  instructionLanguage: string;
  instructionStyle: 'step_by_step' | 'narrative' | 'technical' | 'simplified';
  includeTimestamps: boolean;
  includeTips: boolean;
  includeWarnings: boolean;
  annotateScreenshots: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  videoFileName: string;
  videoFileSize: number;
  videoDuration: number;
  videoResolution: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  pipelineState: import('./pipeline').PipelineState;
  instruction?: import('./instruction').Instruction;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  frameExtractionMethod: 'combined',
  fixedIntervalSeconds: 5,
  sceneChangeThreshold: 0.3,
  maxFrames: 200,
  frameQuality: 85,
  frameResolution: '1280x720',

  whisperModel: 'base',
  whisperLanguage: 'auto',

  kimiModel: 'moonshotai/kimi-k2',
  framesPerBatch: 5,
  analysisPrompt: '',
  generationPrompt: '',
  temperature: 0.3,
  maxTokens: 8192,

  instructionLanguage: 'ru',
  instructionStyle: 'step_by_step',
  includeTimestamps: true,
  includeTips: true,
  includeWarnings: true,
  annotateScreenshots: true,
};
