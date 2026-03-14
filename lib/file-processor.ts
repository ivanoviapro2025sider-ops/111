import { promises as fs } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { load as loadHtml } from 'cheerio';
import yaml from 'js-yaml';
import sharp from 'sharp';
import { parse as parseCsv } from 'csv-parse/sync';
import type { FileProcessingOptions } from '@/types/file';

const textExtensions = new Set([
  '.txt', '.log', '.md', '.rst', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.sh', '.bash', '.sql', '.json', '.jsonl', '.xml',
  '.yml', '.yaml', '.html', '.htm', '.csv', '.svg',
]);

export function chunkText(content: string, chunkSize: number, overlap = 0) {
  const normalized = content.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const next = Math.min(normalized.length, cursor + chunkSize);
    chunks.push(normalized.slice(cursor, next));
    cursor = Math.max(next - overlap, cursor + 1);
  }
  return chunks;
}

export function summarizeText(content: string, limit = 1200) {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) return 'No textual content extracted.';
  return compact.slice(0, limit);
}

export function selectRelevantChunks(content: string, query: string, options: FileProcessingOptions) {
  const chunks = chunkText(content, options.chunkSize, options.chunkOverlap);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return chunks
    .map((chunk) => ({ chunk, score: terms.reduce((sum, term) => sum + (chunk.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.chunk);
}

export async function extractFileContent(filePath: string, mimeType: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    return { text: parsed.text, metadata: { pages: parsed.numpages, info: parsed.info } };
  }
  if (extension === '.docx' || extension === '.doc') {
    const buffer = await fs.readFile(filePath);
    const parsed = await mammoth.extractRawText({ buffer });
    return { text: parsed.value, metadata: { messages: parsed.messages } };
  }
  if (extension === '.xlsx' || extension === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetDump = workbook.SheetNames
      .map((sheetName) => `# ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`)
      .join('\n\n');
    return { text: sheetDump, metadata: { sheets: workbook.SheetNames } };
  }
  if (extension === '.csv') {
    const raw = await fs.readFile(filePath, 'utf8');
    const records = parseCsv(raw, { relax_quotes: true, skip_empty_lines: true });
    return { text: JSON.stringify(records.slice(0, 100), null, 2), metadata: { rows: records.length } };
  }
  if (extension === '.yaml' || extension === '.yml') {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(raw);
    return { text: JSON.stringify(parsed, null, 2), metadata: { kind: 'yaml' } };
  }
  if (extension === '.html' || extension === '.htm') {
    const raw = await fs.readFile(filePath, 'utf8');
    const $ = loadHtml(raw);
    return { text: $('body').text(), metadata: { title: $('title').text() } };
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'].includes(extension)) {
    const meta = await sharp(filePath).metadata();
    return { text: `Image ${path.basename(filePath)}: ${meta.width ?? '?'}x${meta.height ?? '?'} ${mimeType}`, metadata: meta };
  }
  if (textExtensions.has(extension)) {
    const raw = await fs.readFile(filePath, 'utf8');
    return { text: raw, metadata: { extension } };
  }
  return { text: `Binary file ${path.basename(filePath)} (${mimeType}) uploaded successfully. Rich extraction for this format can be extended in lib/file-processor.ts.`, metadata: { extension, extracted: false } };
}

export async function processFile(filePath: string, mimeType: string, options: FileProcessingOptions) {
  const { text, metadata } = await extractFileContent(filePath, mimeType);
  const summary = summarizeText(text, options.strategy === 'summary' ? 800 : 1400);
  const chunks = chunkText(text, options.chunkSize, options.chunkOverlap);
  return { text, summary, chunks, metadata };
}
