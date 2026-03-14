import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import csv from "csv-parser";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import pdf from "pdf-parse";
import YAML from "js-yaml";
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { openrouter } from "@/lib/openrouter";
import type { FileProcessingOptions } from "@/types/file";

const textLike = new Set([
  ".txt",
  ".log",
  ".md",
  ".rst",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".sh",
  ".bash",
  ".sql",
]);

const jsonLike = new Set([".json", ".jsonl"]);
const yamlLike = new Set([".yml", ".yaml"]);
const xmlLike = new Set([".xml"]);
const htmlLike = new Set([".html", ".htm"]);

export interface ProcessedFileResult {
  extension: string;
  extractedText: string;
  chunks: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
}

function chunkText(input: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  if (!input.trim()) return chunks;

  let cursor = 0;
  while (cursor < input.length) {
    const end = Math.min(cursor + chunkSize, input.length);
    chunks.push(input.slice(cursor, end));
    cursor = Math.max(end - overlap, cursor + 1);
  }
  return chunks;
}

async function extractCsv(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rows: string[] = [];
    createReadStream(path)
      .pipe(csv())
      .on("data", (row) => {
        rows.push(Object.values(row).join(", "));
      })
      .on("end", () => resolve(rows.join("\n")))
      .on("error", reject);
  });
}

export async function extractTextFromFile(path: string): Promise<ProcessedFileResult> {
  const extension = extname(path).toLowerCase();

  if (textLike.has(extension)) {
    const text = await readFile(path, "utf8");
    return { extension, extractedText: text, chunks: [] };
  }

  if (jsonLike.has(extension)) {
    const text = await readFile(path, "utf8");
    const parsed = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.stringify(JSON.parse(line), null, 2);
        } catch {
          return line;
        }
      })
      .join("\n");
    return { extension, extractedText: parsed, chunks: [] };
  }

  if (yamlLike.has(extension)) {
    const text = await readFile(path, "utf8");
    const parsed = YAML.load(text);
    return { extension, extractedText: JSON.stringify(parsed, null, 2), chunks: [] };
  }

  if (xmlLike.has(extension)) {
    const text = await readFile(path, "utf8");
    const parser = new XMLParser();
    const parsed = parser.parse(text);
    return { extension, extractedText: JSON.stringify(parsed, null, 2), chunks: [] };
  }

  if (htmlLike.has(extension)) {
    const text = await readFile(path, "utf8");
    const dom = cheerio.load(text);
    return { extension, extractedText: dom.text(), chunks: [] };
  }

  if (extension === ".pdf") {
    const data = await readFile(path);
    const result = await pdf(data);
    return { extension, extractedText: result.text, chunks: [] };
  }

  if (extension === ".docx" || extension === ".doc") {
    const result = await mammoth.extractRawText({ path });
    return { extension, extractedText: result.value, chunks: [] };
  }

  if (extension === ".csv") {
    const result = await extractCsv(path);
    return { extension, extractedText: result, chunks: [] };
  }

  if (extension === ".xls" || extension === ".xlsx") {
    const workbook = XLSX.readFile(path);
    const sheets = workbook.SheetNames.map((sheet) => {
      const data = XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]);
      return `# ${sheet}\n${data}`;
    }).join("\n\n");
    return { extension, extractedText: sheets, chunks: [] };
  }

  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg"].includes(extension)) {
    const metadata = await sharp(path).metadata();
    const text = `Image file (${extension}) - width: ${metadata.width}, height: ${metadata.height}, format: ${metadata.format}`;
    return { extension, extractedText: text, chunks: [], metadata };
  }

  if ([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".mp4", ".webm", ".avi", ".mkv"].includes(extension)) {
    return {
      extension,
      extractedText:
        "Media file detected. Configure OpenRouter speech/vision model for transcription or frame extraction.",
      chunks: [],
    };
  }

  if ([".zip", ".tar", ".tgz", ".gz", ".rar", ".7z"].includes(extension)) {
    return {
      extension,
      extractedText:
        "Archive detected. Extraction pipeline can be plugged in for recursive file processing.",
      chunks: [],
    };
  }

  return {
    extension,
    extractedText: "Unsupported file type. Metadata stored, extraction skipped.",
    chunks: [],
  };
}

export async function summarizeChunks(
  chunks: string[],
  model: string,
): Promise<string | undefined> {
  if (!chunks.length || !process.env.OPENROUTER_API_KEY) return undefined;

  const chunkSummaries: string[] = [];
  for (const chunk of chunks.slice(0, 20)) {
    const completion = await openrouter.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Summarize this chunk in concise bullet points.",
        },
        {
          role: "user",
          content: chunk.slice(0, 12000),
        },
      ],
    });
    chunkSummaries.push(completion.choices[0]?.message?.content ?? "");
  }

  const finalSummary = await openrouter.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "Merge chunk summaries into one structured summary with key points.",
      },
      {
        role: "user",
        content: chunkSummaries.join("\n\n"),
      },
    ],
  });

  return finalSummary.choices[0]?.message?.content ?? undefined;
}

export async function processFileWithStrategy(
  path: string,
  options: FileProcessingOptions,
  model: string,
): Promise<ProcessedFileResult> {
  const result = await extractTextFromFile(path);

  const size = Math.max(1000, options.chunkSize);
  const overlap = Math.max(0, Math.min(options.chunkOverlap, Math.floor(size / 2)));
  result.chunks = chunkText(result.extractedText, size, overlap);

  if (options.strategy === "summary" || options.strategy === "map-reduce") {
    result.summary = await summarizeChunks(result.chunks, model);
  } else if (options.strategy === "chunked") {
    result.summary = result.chunks.slice(0, 5).join("\n\n").slice(0, 4000);
  } else {
    result.summary = result.extractedText.slice(0, 4000);
  }

  return result;
}
