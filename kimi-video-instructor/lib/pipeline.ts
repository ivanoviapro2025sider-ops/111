import { PipelineState, PipelineStage, TranscriptSegment, ExtractedFrame, FrameAnalysis, PIPELINE_STAGES_ORDER, createInitialPipelineState } from '@/types/pipeline';
import { Instruction } from '@/types/instruction';
import { ProjectSettings } from '@/types/project';
import { extractAudio, extractFrames, getVideoInfo } from './video-processor';
import { transcribeAudio } from './transcriber';
import { alignFramesWithTranscript, buildAnalysisBatch } from './frame-analyzer';
import { analyzeFrameBatch, generateInstruction } from './kimi-agent';
import { buildInstruction } from './instruction-generator';
import { getProjectDir } from './file-utils';
import { sleep } from './utils';
import { writeFile } from 'fs/promises';
import path from 'path';
import prisma from './db';

type StatusCallback = (state: PipelineState) => void;

export async function runPipeline(
  projectId: string,
  videoPath: string,
  settings: ProjectSettings,
  onStatus: StatusCallback,
): Promise<Instruction> {
  const state = createInitialPipelineState();
  state.startedAt = new Date().toISOString();
  state.stages.upload.status = 'completed';
  state.stages.upload.progress = 100;

  const projectDir = getProjectDir(projectId);

  // Stage 2: Extract Audio
  state.currentStage = 'extractAudio';
  state.stages.extractAudio.status = 'running';
  state.stages.extractAudio.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let audioPath: string;
  try {
    audioPath = await extractAudio(projectId, videoPath, (progress) => {
      state.stages.extractAudio.progress = progress;
      state.stages.extractAudio.message = `Извлечение аудио... ${progress}%`;
      onStatus({ ...state });
    });
    state.stages.extractAudio.status = 'completed';
    state.stages.extractAudio.progress = 100;
    state.stages.extractAudio.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.extractAudio.status = 'error';
    state.error = { stage: 'extractAudio', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Stage 3: Transcribe
  state.currentStage = 'transcribe';
  state.stages.transcribe.status = 'running';
  state.stages.transcribe.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let transcript: TranscriptSegment[];
  try {
    transcript = await transcribeAudio(audioPath, {
      language: settings.whisperLanguage,
      model: settings.whisperModel,
      provider: (process.env.WHISPER_PROVIDER as 'openrouter' | 'openai' | 'local') || 'openrouter',
    }, (progress, message) => {
      state.stages.transcribe.progress = progress;
      state.stages.transcribe.message = message;
      onStatus({ ...state });
    });

    await writeFile(
      path.join(projectDir, 'transcript.json'),
      JSON.stringify(transcript, null, 2),
    );

    state.stages.transcribe.status = 'completed';
    state.stages.transcribe.progress = 100;
    state.stages.transcribe.result = { segments: transcript.length };
    state.stages.transcribe.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.transcribe.status = 'error';
    state.error = { stage: 'transcribe', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Stage 4: Extract Frames
  state.currentStage = 'extractFrames';
  state.stages.extractFrames.status = 'running';
  state.stages.extractFrames.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let frameInfos;
  try {
    frameInfos = await extractFrames(projectId, videoPath, {
      method: settings.frameExtractionMethod,
      intervalSeconds: settings.fixedIntervalSeconds,
      sceneThreshold: settings.sceneChangeThreshold,
      maxFrames: settings.maxFrames,
      quality: settings.frameQuality,
      resolution: settings.frameResolution,
    }, (progress, message) => {
      state.stages.extractFrames.progress = progress;
      state.stages.extractFrames.message = message;
      onStatus({ ...state });
    });

    state.stages.extractFrames.status = 'completed';
    state.stages.extractFrames.progress = 100;
    state.stages.extractFrames.result = { frames: frameInfos.length };
    state.stages.extractFrames.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.extractFrames.status = 'error';
    state.error = { stage: 'extractFrames', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Stage 5: Align
  state.currentStage = 'align';
  state.stages.align.status = 'running';
  state.stages.align.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let alignedFrames: ExtractedFrame[];
  try {
    alignedFrames = alignFramesWithTranscript(frameInfos, transcript);

    await writeFile(
      path.join(projectDir, 'aligned_data.json'),
      JSON.stringify(alignedFrames, null, 2),
    );

    // Save frames to DB
    for (const frame of alignedFrames) {
      await prisma.frame.upsert({
        where: { id: frame.id },
        update: {
          timestamp: frame.timestamp,
          timestampFormatted: frame.timestampFormatted,
          filePath: frame.filePath,
          thumbnailPath: frame.thumbnailPath,
          fileSize: frame.fileSize,
        },
        create: {
          id: frame.id,
          projectId,
          index: frame.index,
          timestamp: frame.timestamp,
          timestampFormatted: frame.timestampFormatted,
          filePath: frame.filePath,
          thumbnailPath: frame.thumbnailPath,
          fileSize: frame.fileSize,
        },
      });
    }

    state.stages.align.status = 'completed';
    state.stages.align.progress = 100;
    state.stages.align.result = { pairs: alignedFrames.length };
    state.stages.align.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.align.status = 'error';
    state.error = { stage: 'align', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Stage 6: Analyze with KIMI
  state.currentStage = 'analyze';
  state.stages.analyze.status = 'running';
  state.stages.analyze.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let allAnalyses: FrameAnalysis[] = [];
  try {
    const batches = buildAnalysisBatch(alignedFrames, settings.framesPerBatch);
    let processedBatches = 0;

    for (const batch of batches) {
      const analyses = await analyzeFrameBatch(batch, {
        model: settings.kimiModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        analysisPrompt: settings.analysisPrompt,
        retryAttempts: 3,
        retryDelay: 2000,
      });

      allAnalyses.push(...analyses);
      processedBatches++;

      const progress = Math.round((processedBatches / batches.length) * 100);
      state.stages.analyze.progress = progress;
      state.stages.analyze.message = `Батч ${processedBatches}/${batches.length}`;
      onStatus({ ...state });

      if (processedBatches < batches.length) {
        await sleep(1000);
      }
    }

    await writeFile(
      path.join(projectDir, 'analysis.json'),
      JSON.stringify(allAnalyses, null, 2),
    );

    state.stages.analyze.status = 'completed';
    state.stages.analyze.progress = 100;
    state.stages.analyze.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.analyze.status = 'error';
    state.error = { stage: 'analyze', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Stage 7: Generate Instruction
  state.currentStage = 'generate';
  state.stages.generate.status = 'running';
  state.stages.generate.startedAt = new Date().toISOString();
  onStatus({ ...state });

  let instruction: Instruction;
  try {
    const videoInfo = await getVideoInfo(videoPath);
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    const generated = await generateInstruction(allAnalyses, {
      model: settings.kimiModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      generationPrompt: settings.generationPrompt,
      language: settings.instructionLanguage,
      style: settings.instructionStyle,
    });

    instruction = buildInstruction(
      generated,
      alignedFrames,
      project?.videoFileName || 'video',
      videoInfo.duration,
      settings.kimiModel,
      settings.instructionLanguage,
    );

    await writeFile(
      path.join(projectDir, 'instruction.json'),
      JSON.stringify(instruction, null, 2),
    );

    state.stages.generate.status = 'completed';
    state.stages.generate.progress = 100;
    state.stages.generate.completedAt = new Date().toISOString();
    state.completedAt = new Date().toISOString();
    onStatus({ ...state });
  } catch (err) {
    state.stages.generate.status = 'error';
    state.error = { stage: 'generate', message: (err as Error).message };
    onStatus({ ...state });
    throw err;
  }

  // Update project
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'review',
      pipelineState: JSON.stringify(state),
      instruction: JSON.stringify(instruction),
    },
  });

  return instruction;
}
