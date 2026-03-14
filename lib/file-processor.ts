import { getFileExtension } from './utils';
import fs from 'fs/promises';
import path from 'path';

const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'md', 'rst', 'js', 'ts', 'jsx', 'tsx', 'py', 'java',
  'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift',
  'kt', 'sh', 'bash', 'sql', 'html', 'htm', 'css', 'json', 'jsonl',
  'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'gitignore', 'dockerignore', 'editorconfig',
]);

export async function processFile(filePath: string, originalName: string): Promise<string> {
  const ext = getFileExtension(originalName);

  try {
    if (TEXT_EXTENSIONS.has(ext)) {
      return await processTextFile(filePath);
    }

    switch (ext) {
      case 'pdf':
        return await processPdf(filePath);
      case 'docx':
      case 'doc':
        return await processDocx(filePath);
      case 'xlsx':
      case 'xls':
        return await processXlsx(filePath);
      case 'csv':
        return await processCsv(filePath);
      case 'json':
        return await processJson(filePath);
      case 'xml':
        return await processXml(filePath);
      case 'yaml':
      case 'yml':
        return await processYaml(filePath);
      default:
        if (isImageExtension(ext)) {
          return `[Image file: ${originalName}] - Image analysis requires vision model capabilities.`;
        }
        if (isAudioExtension(ext)) {
          return `[Audio file: ${originalName}] - Audio transcription requires Whisper API.`;
        }
        if (isVideoExtension(ext)) {
          return `[Video file: ${originalName}] - Video processing requires frame extraction.`;
        }
        return await processTextFile(filePath).catch(
          () => `[Binary file: ${originalName}] - Cannot extract text content.`
        );
    }
  } catch (error) {
    return `[Error processing ${originalName}]: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function processTextFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return truncateContent(content);
}

async function processPdf(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return truncateContent(data.text);
}

async function processDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return truncateContent(result.value);
}

async function processXlsx(filePath: string): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return truncateContent(sheets.join('\n\n'));
}

async function processCsv(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return truncateContent(content);
}

async function processJson(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    return truncateContent(JSON.stringify(parsed, null, 2));
  } catch {
    return truncateContent(content);
  }
}

async function processXml(filePath: string): Promise<string> {
  const { XMLParser } = await import('fast-xml-parser');
  const content = await fs.readFile(filePath, 'utf-8');
  const parser = new XMLParser();
  const result = parser.parse(content);
  return truncateContent(JSON.stringify(result, null, 2));
}

async function processYaml(filePath: string): Promise<string> {
  const yaml = await import('js-yaml');
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = yaml.load(content);
  return truncateContent(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
}

function isImageExtension(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext);
}

function isAudioExtension(ext: string): boolean {
  return ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext);
}

function isVideoExtension(ext: string): boolean {
  return ['mp4', 'webm', 'avi', 'mkv'].includes(ext);
}

function truncateContent(content: string, maxLength = 100000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '\n\n[Content truncated - showing first 100,000 characters]';
}

export function chunkContent(content: string, chunkSize = 4000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push(content.slice(start, end));
    start = end - overlap;
    if (start + overlap >= content.length) break;
  }

  return chunks;
}
