import { getOpenRouter } from './openrouter';
import { ExtractedFrame, FrameAnalysis } from '@/types/pipeline';
import { frameToBase64, parseAnalysisResponse } from './frame-analyzer';
import { retryAsync, sleep } from './utils';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_GENERATION_PROMPT } from '@/types/agent';

interface AnalyzeOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  analysisPrompt: string;
  retryAttempts: number;
  retryDelay: number;
}

export async function analyzeFrameBatch(
  frames: ExtractedFrame[],
  options: AnalyzeOptions,
): Promise<FrameAnalysis[]> {
  const client = getOpenRouter();

  const transcriptText = frames
    .flatMap((f) => f.transcriptSegments)
    .map((seg) => `[${seg.start.toFixed(1)}s] ${seg.text}`)
    .join('\n');

  const prompt = (options.analysisPrompt || DEFAULT_ANALYSIS_PROMPT)
    .replace('{transcript_text}', transcriptText);

  const imageContents = await Promise.all(
    frames.map(async (frame) => {
      try {
        const base64 = await frameToBase64(frame.filePath);
        return {
          type: 'image_url' as const,
          image_url: { url: base64 },
        };
      } catch {
        return null;
      }
    }),
  );

  const validImages = imageContents.filter(Boolean);

  const frameInfoText = frames
    .map((f) => `Frame ID: ${f.id}, Timestamp: ${f.timestampFormatted} (${f.timestamp}s)`)
    .join('\n');

  const response = await retryAsync(
    () =>
      client.chat.completions.create({
        model: options.model,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Кадры для анализа:\n${frameInfoText}` },
              ...(validImages as Array<{ type: 'image_url'; image_url: { url: string } }>),
            ],
          },
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    options.retryAttempts,
    options.retryDelay,
  );

  const content = response.choices[0]?.message?.content || '';
  return parseAnalysisResponse(content);
}

interface GenerateOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  generationPrompt: string;
  language: string;
  style: string;
}

export interface GeneratedInstruction {
  title: string;
  description: string;
  steps: Array<{
    order: number;
    title: string;
    description: string;
    frameId: string;
    tips?: string[];
    warnings?: string[];
  }>;
}

export async function generateInstruction(
  analyses: FrameAnalysis[],
  options: GenerateOptions,
): Promise<GeneratedInstruction> {
  const client = getOpenRouter();

  const prompt = (options.generationPrompt || DEFAULT_GENERATION_PROMPT)
    .replace('{language}', options.language)
    .replace('{style}', options.style);

  const response = await client.chat.completions.create({
    model: options.model,
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: `Данные анализа кадров:\n${JSON.stringify(analyses, null, 2)}`,
      },
    ],
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error('Failed to parse instruction generation response');
  }

  return {
    title: 'Инструкция',
    description: 'Автоматически сгенерированная инструкция',
    steps: analyses
      .filter((a) => a.isImportantStep)
      .map((a, idx) => ({
        order: idx + 1,
        title: a.suggestedStepTitle || `Шаг ${idx + 1}`,
        description: a.userAction || a.description,
        frameId: a.frameId,
        tips: [],
        warnings: [],
      })),
  };
}
