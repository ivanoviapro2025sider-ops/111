import { getFileExtension } from './utils';

export async function extractTextFromFile(filePath: string, originalName: string): Promise<string> {
  const ext = getFileExtension(originalName).toLowerCase();

  switch (ext) {
    case '.txt':
    case '.md':
    case '.rst':
    case '.log':
    case '.csv':
    case '.json':
    case '.jsonl':
    case '.yml':
    case '.yaml':
    case '.xml':
    case '.html':
    case '.htm':
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
    case '.svg':
      return extractPlainText(filePath);

    case '.pdf':
      return extractPDF(filePath);

    case '.docx':
    case '.doc':
      return extractWord(filePath);

    case '.xlsx':
    case '.xls':
      return extractExcel(filePath);

    default:
      return `[File: ${originalName} - binary content not extractable]`;
  }
}

async function extractPlainText(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  return fs.readFile(filePath, 'utf-8');
}

async function extractPDF(filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (e) {
    return `[Error extracting PDF: ${e instanceof Error ? e.message : 'unknown error'}]`;
  }
}

async function extractWord(filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const mammoth = await import('mammoth');
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (e) {
    return `[Error extracting Word document: ${e instanceof Error ? e.message : 'unknown error'}]`;
  }
}

async function extractExcel(filePath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const XLSX = await import('xlsx');
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      lines.push(`\n--- Sheet: ${sheetName} ---\n`);
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(csv);
    }

    return lines.join('\n');
  } catch (e) {
    return `[Error extracting Excel: ${e instanceof Error ? e.message : 'unknown error'}]`;
  }
}

export function chunkText(text: string, chunkSize: number = 4000, overlap: number = 200): string[] {
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

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
