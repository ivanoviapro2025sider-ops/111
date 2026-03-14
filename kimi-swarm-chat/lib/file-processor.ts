import path from "node:path";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import { XMLParser } from "fast-xml-parser";
import yaml from "js-yaml";
import * as cheerio from "cheerio";
import openrouter from "@/lib/openrouter";

export type ProcessingStrategy = "full" | "chunked" | "summary" | "map-reduce";

export interface FileProcessingOptions {
  strategy: ProcessingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  maxContextTokens: number;
  preprocessor?: "ocr" | "transcribe" | "extract-frames";
}

export interface ProcessedFileResult {
  text: string;
  chunks: string[];
  summary?: string;
  metadata: Record<string, unknown>;
}

const textExtensions = new Set([
  ".txt",
  ".log",
  ".md",
  ".rst",
  ".json",
  ".jsonl",
  ".js",
  ".ts",
  ".jsx",
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

function semanticChunk(text: string, chunkSize: number, chunkOverlap: number) {
  if (!text.trim()) return [];
  const paragraphs = text.split(/\n{2,}/g).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length + 2 > chunkSize && current) {
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - chunkOverlap));
      current = `${tail}\n\n${paragraph}`;
    } else {
      current += `${current ? "\n\n" : ""}${paragraph}`;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function extractCsv(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(JSON.stringify(rows, null, 2)))
      .on("error", reject);
  });
}

async function extractText(filePath: string, extension: string) {
  const ext = extension.toLowerCase();

  if (ext === ".pdf") {
    const content = await readFile(filePath);
    const result = await pdfParse(content);
    return result.text;
  }

  if (ext === ".doc" || ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".xls" || ext === ".xlsx") {
    const wb = xlsx.readFile(filePath);
    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      const json = xlsx.utils.sheet_to_json(ws, { header: 1 });
      return `# ${name}\n${JSON.stringify(json, null, 2)}`;
    });
    return sheets.join("\n\n");
  }

  if (ext === ".csv") {
    return extractCsv(filePath);
  }

  if (ext === ".xml") {
    const parser = new XMLParser();
    const xml = await readFile(filePath, "utf-8");
    return JSON.stringify(parser.parse(xml), null, 2);
  }

  if (ext === ".yml" || ext === ".yaml") {
    const input = await readFile(filePath, "utf-8");
    return JSON.stringify(yaml.load(input), null, 2);
  }

  if (ext === ".html" || ext === ".htm") {
    const html = await readFile(filePath, "utf-8");
    const $ = cheerio.load(html);
    return $.text();
  }

  if (textExtensions.has(ext)) {
    return readFile(filePath, "utf-8");
  }

  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tiff"].includes(ext)) {
    return `[IMAGE FILE] ${path.basename(filePath)}. OCR/vision preprocessing can be applied via preprocessor=ocr.`;
  }

  if ([".mp3", ".wav", ".ogg", ".flac", ".m4a"].includes(ext)) {
    return `[AUDIO FILE] ${path.basename(filePath)}. Transcription preprocessing can be applied via preprocessor=transcribe.`;
  }

  if ([".mp4", ".webm", ".avi", ".mkv"].includes(ext)) {
    return `[VIDEO FILE] ${path.basename(filePath)}. Frame/audio extraction can be applied via preprocessor=extract-frames.`;
  }

  if ([".zip", ".rar", ".7z", ".tar", ".tgz", ".gz"].includes(ext)) {
    return `[ARCHIVE FILE] ${path.basename(filePath)}. Archive extraction pipeline placeholder.`;
  }

  return `[UNSUPPORTED FILE TYPE] ${path.basename(filePath)} (${ext || "unknown"})`;
}

async function summarizeChunks(chunks: string[], model: string) {
  if (!chunks.length) return "";

  const mapped: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const response = await openrouter.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You summarize chunks from large documents. Return concise bullet points.",
        },
        {
          role: "user",
          content: `Chunk ${index + 1}/${chunks.length}\n\n${chunk}`,
        },
      ],
      max_tokens: 500,
    });

    mapped.push(response.choices[0]?.message?.content?.trim() || "");
  }

  const reduced = await openrouter.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You merge partial chunk summaries into one clear structured final summary.",
      },
      {
        role: "user",
        content: mapped.join("\n\n"),
      },
    ],
    max_tokens: 800,
  });

  return reduced.choices[0]?.message?.content?.trim() || "";
}

export async function processFile(
  filePath: string,
  options: FileProcessingOptions,
  model = process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2",
): Promise<ProcessedFileResult> {
  const fileStat = await stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const text = await extractText(filePath, ext);
  const chunks = semanticChunk(text, options.chunkSize, options.chunkOverlap);

  let summary: string | undefined;
  if (options.strategy === "summary" || options.strategy === "map-reduce") {
    if (process.env.OPENROUTER_API_KEY) {
      summary = await summarizeChunks(chunks, model);
    } else {
      summary = "OPENROUTER_API_KEY missing; summary generation skipped.";
    }
  }

  return {
    text: options.strategy === "chunked" ? "" : text,
    chunks,
    summary,
    metadata: {
      extension: ext,
      size: fileStat.size,
      chunkCount: chunks.length,
      strategy: options.strategy,
      preprocessor: options.preprocessor ?? null,
    },
  };
}
