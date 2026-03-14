import { readFile } from 'fs/promises';
import { TranscriptSegment } from '@/types/pipeline';
import { getOpenRouter } from './openrouter';

export interface TranscriptionOptions {
  language: string;
  model: string;
  provider: 'openrouter' | 'openai' | 'local';
}

export async function transcribeAudio(
  audioPath: string,
  options: TranscriptionOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<TranscriptSegment[]> {
  onProgress?.(10, 'Подготовка аудиофайла...');

  if (options.provider === 'openrouter' || options.provider === 'openai') {
    return transcribeWithAPI(audioPath, options, onProgress);
  }

  return transcribeLocal(audioPath, options, onProgress);
}

async function transcribeWithAPI(
  audioPath: string,
  options: TranscriptionOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<TranscriptSegment[]> {
  onProgress?.(20, 'Отправка аудио на транскрипцию...');

  try {
    const OpenAI = (await import('openai')).default;

    const client = options.provider === 'openai'
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : getOpenRouter();

    const audioBuffer = await readFile(audioPath);
    const audioFile = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

    onProgress?.(40, 'Транскрипция в процессе...');

    const response = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: options.language === 'auto' ? undefined : options.language,
      timestamp_granularities: ['segment'],
    } as never);

    onProgress?.(80, 'Обработка результатов...');

    const result = response as unknown as {
      segments?: Array<{
        id: number;
        text: string;
        start: number;
        end: number;
        avg_logprob?: number;
      }>;
      text?: string;
    };

    if (result.segments && result.segments.length > 0) {
      const segments: TranscriptSegment[] = result.segments.map((seg, idx) => ({
        id: idx,
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end,
        confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9,
      }));
      onProgress?.(100, `Транскрибировано ${segments.length} сегментов`);
      return segments;
    }

    if (result.text) {
      onProgress?.(100, 'Транскрипция завершена');
      return [{
        id: 0,
        text: result.text,
        start: 0,
        end: 0,
        confidence: 0.9,
      }];
    }

    return [];
  } catch (error) {
    console.error('Transcription error:', error);
    onProgress?.(100, 'Ошибка транскрипции, создана заглушка');
    return [{
      id: 0,
      text: '[Транскрипция недоступна — проверьте API ключ и настройки]',
      start: 0,
      end: 0,
      confidence: 0,
    }];
  }
}

async function transcribeLocal(
  _audioPath: string,
  _options: TranscriptionOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<TranscriptSegment[]> {
  onProgress?.(100, 'Локальная транскрипция не настроена');
  return [{
    id: 0,
    text: '[Локальная транскрипция whisper.cpp не настроена. Используйте OpenRouter или OpenAI провайдер.]',
    start: 0,
    end: 0,
    confidence: 0,
  }];
}
