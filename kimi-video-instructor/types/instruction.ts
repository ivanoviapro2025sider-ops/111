import { Annotation } from './pipeline';

export interface Instruction {
  id: string;
  title: string;
  description: string;
  totalSteps: number;
  estimatedReadTime: number;
  steps: InstructionStep[];
  metadata: {
    sourceVideo: string;
    videoDuration: number;
    generatedAt: string;
    model: string;
    language: string;
  };
}

export interface InstructionStep {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshot: {
    path: string;
    annotations: Annotation[];
    caption?: string;
  };
  timestamp: number;
  timestampFormatted: string;
  tips?: string[];
  warnings?: string[];
  notes?: string;
  isManuallyEdited: boolean;
}
