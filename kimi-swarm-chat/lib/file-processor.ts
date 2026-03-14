import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import Papa from "papaparse";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import * as XLSX from "xlsx";
import yaml from "js-yaml";
import { XMLParser } from "fast-xml-parser";
import type { FileProcessingOptions } from "@/types/file";
import { hasOpenRouterKey, openrouter } from "./openrouter";

const codeExtensions = new Set([
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

const plainTextExtensions = new Set([
  ".txt",
  ".log",
  ".md",
  ".rst",
  ".json",
  ".jsonl",
  ".xml",
  ".yml",
  ".yaml",
  ".csv",
  ".html",
  ".htm",
]);

export async function extractFileText(filePath: string, mimeType?: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const fileBuffer = await readFile(filePath);

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text || "";
  }

  if (ext === ".docx" || ext === ".doc") {
    const doc = await mammoth.extractRawText({ buffer: fileBuffer });
    return doc.value || "";
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => {
      const rows = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName] ?? {});
      return `## Sheet: ${sheetName}\n${rows}`;
    }).join("\n\n");
  }

  if (ext === ".csv") {
    const csvText = fileBuffer.toString("utf-8");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    return JSON.stringify(parsed.data, null, 2);
  }

  if (ext === ".json" || ext === ".jsonl") {
    return fileBuffer.toString("utf-8");
  }

  if (ext === ".xml") {
    const parser = new XMLParser({ ignoreAttributes: false });
    const xml = parser.parse(fileBuffer.toString("utf-8"));
    return JSON.stringify(xml, null, 2);
  }

  if (ext === ".yml" || ext === ".yaml") {
    const doc = yaml.load(fileBuffer.toString("utf-8"));
    return JSON.stringify(doc, null, 2);
  }

  if (mimeType?.startsWith("image/")) {
    const image = sharp(fileBuffer);
    const meta = await image.metadata();
    return `Image metadata:\n${JSON.stringify(meta, null, 2)}`;
  }

  if (codeExtensions.has(ext) || plainTextExtensions.has(ext) || mimeType?.startsWith("text/")) {
    return fileBuffer.toString("utf-8");
  }

  return `Binary file detected (${ext || mimeType || "unknown"}). Text extraction is not implemented for this format yet.`;
}

export function chunkText(
  text: string,
  options: Pick<FileProcessingOptions, "chunkSize" | "chunkOverlap">,
) {
  if (!text) return [];
  const chunks: string[] = [];
  const { chunkSize, chunkOverlap } = options;
  let cursor = 0;
  while (cursor < text.length) {
    const end = Math.min(cursor + chunkSize, text.length);
    chunks.push(text.slice(cursor, end));
    if (end >= text.length) break;
    cursor = Math.max(0, end - chunkOverlap);
  }
  return chunks;
}

async function summarizeChunk(chunk: string, query?: string) {
  if (!hasOpenRouterKey()) {
    return chunk.slice(0, 1000);
  }

  const completion = await openrouter.chat.completions.create({
    model: process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2",
    messages: [
      {
        role: "system",
        content:
          "Summarize the provided text chunk. Keep key entities, figures, and decisions. Answer in Russian.",
      },
      {
        role: "user",
        content: query
          ? `User query: ${query}\n\nChunk:\n${chunk}`
          : `Chunk:\n${chunk}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 700,
  });

  return completion.choices[0]?.message?.content || "";
}

export async function processFile(
  filePath: string,
  options: FileProcessingOptions,
  query?: string,
) {
  const fullText = await extractFileText(filePath);
  if (options.strategy === "full") {
    return {
      extractedText: fullText,
      summary: fullText.slice(0, 8000),
      chunks: 1,
    };
  }

  const chunks = chunkText(fullText, {
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
  });

  if (chunks.length === 0) {
    return {
      extractedText: "",
      summary: "",
      chunks: 0,
    };
  }

  const partialSummaries: string[] = [];
  for (const chunk of chunks.slice(0, 20)) {
    // Hard cap to avoid expensive processing for very large files in local mode.
    partialSummaries.push(await summarizeChunk(chunk, query));
  }

  const mergedSummary = partialSummaries.join("\n\n");

  return {
    extractedText:
      options.strategy === "summary"
        ? ""
        : chunks.slice(0, 8).join("\n\n"),
    summary: mergedSummary.slice(0, options.maxContextTokens * 4),
    chunks: chunks.length,
  };
}
