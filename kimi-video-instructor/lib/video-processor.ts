import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, stat } from 'fs/promises';
import { getProjectDir, getFramesDir, getThumbnailsDir } from './file-utils';
import { formatTimestamp } from './utils';

const execAsync = promisify(exec);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
}

export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  const cmd = `${FFPROBE} -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
  const { stdout } = await execAsync(cmd);
  const data = JSON.parse(stdout);

  const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
  const format = data.format || {};

  const fps = videoStream?.r_frame_rate
    ? eval(videoStream.r_frame_rate)
    : 30;

  return {
    duration: parseFloat(format.duration || '0'),
    width: parseInt(videoStream?.width || '0'),
    height: parseInt(videoStream?.height || '0'),
    fps,
    codec: videoStream?.codec_name || 'unknown',
    bitrate: parseInt(format.bit_rate || '0'),
  };
}

export async function extractAudio(
  projectId: string,
  videoPath: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const projectDir = getProjectDir(projectId);
  const audioPath = path.join(projectDir, 'audio.wav');

  const cmd = `${FFMPEG} -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" 2>&1`;

  await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
  onProgress?.(100);

  return audioPath;
}

export interface FrameExtractionOptions {
  method: 'scene_detect' | 'fixed_interval' | 'transcript_aligned' | 'combined';
  intervalSeconds: number;
  sceneThreshold: number;
  maxFrames: number;
  quality: number;
  resolution: string;
}

export interface ExtractedFrameInfo {
  index: number;
  timestamp: number;
  timestampFormatted: string;
  filePath: string;
  thumbnailPath: string;
  fileSize: number;
}

export async function extractFrames(
  projectId: string,
  videoPath: string,
  options: FrameExtractionOptions,
  onProgress?: (progress: number, message: string) => void,
): Promise<ExtractedFrameInfo[]> {
  const framesDir = getFramesDir(projectId);
  const thumbDir = getThumbnailsDir(projectId);
  await mkdir(framesDir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const info = await getVideoInfo(videoPath);
  const frames: ExtractedFrameInfo[] = [];

  const [width, height] = options.resolution.split('x').map(Number);
  const scale = `${width}:${height}`;

  if (options.method === 'fixed_interval' || options.method === 'combined') {
    const totalFrames = Math.min(
      Math.floor(info.duration / options.intervalSeconds),
      options.maxFrames,
    );

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * options.intervalSeconds;
      const idx = (i + 1).toString().padStart(3, '0');
      const tsFormatted = formatTimestamp(timestamp);
      const framePath = path.join(framesDir, `frame_${idx}_${tsFormatted}.jpg`);
      const thumbPath = path.join(thumbDir, `thumb_${idx}.jpg`);

      const cmd = `${FFMPEG} -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v ${Math.round((100 - options.quality) / 10 + 1)} -vf "scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2" "${framePath}" 2>&1`;
      try {
        await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      } catch {
        continue;
      }

      const thumbCmd = `${FFMPEG} -y -i "${framePath}" -vf "scale=320:-1" "${thumbPath}" 2>&1`;
      try {
        await execAsync(thumbCmd, { maxBuffer: 10 * 1024 * 1024 });
      } catch {
        // Thumbnail generation is not critical
      }

      let fileSize = 0;
      try {
        const s = await stat(framePath);
        fileSize = s.size;
      } catch {
        // ignore
      }

      frames.push({
        index: i,
        timestamp,
        timestampFormatted: tsFormatted,
        filePath: framePath,
        thumbnailPath: thumbPath,
        fileSize,
      });

      onProgress?.(Math.round(((i + 1) / totalFrames) * 100), `Кадр ${i + 1}/${totalFrames}`);
    }
  } else if (options.method === 'scene_detect') {
    const cmd = `${FFMPEG} -y -i "${videoPath}" -vf "select='gt(scene,${options.sceneThreshold})',scale=${scale}:force_original_aspect_ratio=decrease" -vsync vfr -q:v 2 "${framesDir}/frame_%03d.jpg" 2>&1`;
    try {
      await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 300000 });
    } catch {
      // Scene detection may timeout for long videos, fall back to interval
      return extractFrames(projectId, videoPath, { ...options, method: 'fixed_interval' }, onProgress);
    }

    const { readdir } = await import('fs/promises');
    const files = (await readdir(framesDir)).filter((f) => f.startsWith('frame_')).sort();

    for (let i = 0; i < Math.min(files.length, options.maxFrames); i++) {
      const filePath = path.join(framesDir, files[i]);
      let fileSize = 0;
      try {
        const s = await stat(filePath);
        fileSize = s.size;
      } catch {}
      const timestamp = i * (info.duration / files.length);
      frames.push({
        index: i,
        timestamp,
        timestampFormatted: formatTimestamp(timestamp),
        filePath,
        thumbnailPath: '',
        fileSize,
      });
      onProgress?.(Math.round(((i + 1) / files.length) * 100), `Кадр ${i + 1}/${files.length}`);
    }
  } else {
    return extractFrames(projectId, videoPath, { ...options, method: 'fixed_interval' }, onProgress);
  }

  onProgress?.(100, `Извлечено ${frames.length} кадров`);
  return frames;
}
