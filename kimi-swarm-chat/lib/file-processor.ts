import fs from "node:fs/promises";
import path from "node:path";
import * as yaml from "js-yaml";
import { XMLParser } from "fast-xml-parser";
import { load as loadHtml } from "cheerio";
import mammoth from "mammoth";
import Papa from "papaparse";
import pdf from "pdf-parse";
import sharp from "sharp";
import xlsx from "xlsx";
import openrouter, { DEFAULT_MODEL } from "@/lib/openrouter";
import type { FileProcessingOptions } from "@/types/file";

const textExtensions = new Set([
  ".txt",
  ".md",
  ".rst",
  ".log",
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
  ".jsonl",
]);

export async function extractFileContent(filePath: string, mimeType?: string) {
  const ext = path.extname(filePath).toLowerCase();
  const fileBuffer = await fs.readFile(filePath);

  if (textExtensions.has(ext)) {
    return fileBuffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    const parsed = await pdf(fileBuffer);
    return parsed.text;
  }

  if (ext === ".docx" || ext === ".doc") {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (ext === ".csv") {
    const parsed = Papa.parse<string[]>(fileBuffer.toString("utf-8"), {
      header: false,
      skipEmptyLines: true,
    });
    return parsed.data.map((row) => row.join(", ")).join("\n");
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `# ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  if (ext === ".json") {
    const jsonData = JSON.parse(fileBuffer.toString("utf-8"));
    return JSON.stringify(jsonData, null, 2);
  }

  if (ext === ".xml") {
    const parser = new XMLParser({ ignoreAttributes: false, format: true });
    const xmlJson = parser.parse(fileBuffer.toString("utf-8"));
    return JSON.stringify(xmlJson, null, 2);
  }

  if (ext === ".yml" || ext === ".yaml") {
    const yml = yaml.load(fileBuffer.toString("utf-8"));
    return JSON.stringify(yml, null, 2);
  }

  if (ext === ".html" || ext === ".htm") {
    const $ = loadHtml(fileBuffer.toString("utf-8"));
    return $("body").text().replace(/\s+/g, " ").trim();
  }

  if (
    [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".tiff"].includes(ext) ||
    mimeType?.startsWith("image/")
  ) {
    const meta = await sharp(fileBuffer).metadata();
    return `Image metadata:\n${JSON.stringify(meta, null, 2)}`;
  }

  return `File type ${ext || mimeType || "unknown"} is uploaded. Text extraction is not implemented for this format yet.`;
}

export function chunkText(input: string, chunkSize: number, chunkOverlap: number) {
  if (chunkSize <= 0) return [input];
  const chunks: string[] = [];
  let index = 0;
  while (index < input.length) {
    const end = Math.min(index + chunkSize, input.length);
    chunks.push(input.slice(index, end));
    const nextIndex = end - chunkOverlap;
    index = nextIndex > index ? nextIndex : end;
  }
  return chunks;
}

export async function summarizeChunk(text: string) {
  const completion = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: "Summarize the provided file chunk in Russian." },
      { role: "user", content: text.slice(0, 15000) },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content ?? "";
}

export async function processFile(
  filePath: string,
  options: FileProcessingOptions,
  mimeType?: string,
) {
  const content = await extractFileContent(filePath, mimeType);

  if (options.strategy === "full") {
    return content.slice(0, options.maxContextTokens * 4);
  }

  const chunks = chunkText(content, options.chunkSize, options.chunkOverlap);

  if (options.strategy === "chunked") {
    return chunks.slice(0, 10).join("\n\n---\n\n");
  }

  const summaries: string[] = [];
  for (const chunk of chunks.slice(0, 12)) {
    // Sequential summarization keeps memory bounded for very large files.
    summaries.push(await summarizeChunk(chunk));
  }

  if (options.strategy === "summary") {
    return summaries.join("\n");
  }

  const finalSummary = await summarizeChunk(summaries.join("\n\n"));
  return finalSummary;
}
