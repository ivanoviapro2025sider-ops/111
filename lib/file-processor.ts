import { FileProcessingOptions } from '@/types/file';
import { getFileExtension } from './utils';
import fs from 'fs';
import path from 'path';

export async function processFile(
  filePath: string,
  originalName: string,
  options: Partial<FileProcessingOptions> = {}
): Promise<string> {
  const ext = getFileExtension(originalName);
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  try {
    switch (ext) {
      case '.txt':
      case '.log':
      case '.md':
      case '.rst':
        return fs.readFileSync(fullPath, 'utf-8');

      case '.json':
        return fs.readFileSync(fullPath, 'utf-8');

      case '.jsonl':
        return fs.readFileSync(fullPath, 'utf-8');

      case '.csv': {
        const Papa = (await import('papaparse')).default;
        const csvContent = fs.readFileSync(fullPath, 'utf-8');
        const parsed = Papa.parse(csvContent, { header: true });
        return JSON.stringify(parsed.data, null, 2);
      }

      case '.xml': {
        const { XMLParser } = await import('fast-xml-parser');
        const parser = new XMLParser();
        const xmlContent = fs.readFileSync(fullPath, 'utf-8');
        const result = parser.parse(xmlContent);
        return JSON.stringify(result, null, 2);
      }

      case '.yml':
      case '.yaml': {
        const yaml = (await import('js-yaml')).default;
        const yamlContent = fs.readFileSync(fullPath, 'utf-8');
        const parsed = yaml.load(yamlContent);
        return JSON.stringify(parsed, null, 2);
      }

      case '.html':
      case '.htm': {
        const cheerio = await import('cheerio');
        const htmlContent = fs.readFileSync(fullPath, 'utf-8');
        const $ = cheerio.load(htmlContent);
        $('script, style').remove();
        return $('body').text().replace(/\s+/g, ' ').trim();
      }

      case '.pdf': {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfBuffer = fs.readFileSync(fullPath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;
      }

      case '.docx':
      case '.doc': {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: fullPath });
        return result.value;
      }

      case '.xlsx':
      case '.xls': {
        const XLSX = (await import('xlsx')).default;
        const workbook = XLSX.readFile(fullPath);
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          text += `\n--- Sheet: ${sheetName} ---\n`;
          text += XLSX.utils.sheet_to_csv(sheet);
        }
        return text;
      }

      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
      case '.py':
      case '.java':
      case '.c':
      case '.cpp':
      case '.h':
      case '.hpp':
      case '.cs':
      case '.go':
      case '.rs':
      case '.php':
      case '.rb':
      case '.swift':
      case '.kt':
      case '.sh':
      case '.bash':
      case '.sql':
        return fs.readFileSync(fullPath, 'utf-8');

      default: {
        try {
          return fs.readFileSync(fullPath, 'utf-8');
        } catch {
          return `[Binary file: ${originalName}] - Cannot extract text content`;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing file ${originalName}:`, error);
    throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function chunkText(
  text: string,
  chunkSize: number = 4000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

export function summarizeChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0];
  return chunks.map((c, i) => `[Chunk ${i + 1}/${chunks.length}]\n${c}`).join('\n\n');
}
