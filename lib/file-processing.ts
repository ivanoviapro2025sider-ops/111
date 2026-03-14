import { open, readFile } from "node:fs/promises";
import path from "node:path";

import type { ChatArtifact, Settings, UploadRecord } from "@/lib/types";

interface FileContextBundle {
  artifacts: ChatArtifact[];
  inlineImages: Array<{
    type: "image_url";
    image_url: {
      url: string;
    };
  }>;
}

async function readSlice(filePath: string, offset: number, length: number) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function sampleTextFile(filePath: string, size: number, samplingBytes: number) {
  if (size <= samplingBytes) {
    return readFile(filePath, "utf8");
  }

  const headBytes = Math.floor(samplingBytes / 3);
  const middleBytes = Math.floor(samplingBytes / 3);
  const tailBytes = samplingBytes - headBytes - middleBytes;
  const middleOffset = Math.max(0, Math.floor(size / 2) - Math.floor(middleBytes / 2));
  const tailOffset = Math.max(0, size - tailBytes);

  const [head, middle, tail] = await Promise.all([
    readSlice(filePath, 0, headBytes),
    readSlice(filePath, middleOffset, middleBytes),
    readSlice(filePath, tailOffset, tailBytes)
  ]);

  return [
    "[beginning]",
    head.trim(),
    "",
    "[middle]",
    middle.trim(),
    "",
    "[end]",
    tail.trim()
  ]
    .join("\n")
    .trim();
}

async function extractPdfText(filePath: string) {
  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await readFile(filePath));
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return parsed.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(filePath: string) {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(await readFile(filePath));
  const parsed = await mammoth.extractRawText({ buffer });
  return parsed.value.trim();
}

async function extractSpreadsheetPreview(filePath: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await readFile(filePath));
  await workbook.xlsx.load(buffer as unknown as Buffer);

  const lines: string[] = [];

  for (const worksheet of workbook.worksheets.slice(0, 3)) {
    lines.push(`# Sheet: ${worksheet.name}`);
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 10) {
        return;
      }
      const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
      const values = rowValues.map((value) => (value === null || value === undefined ? "" : String(value)));
      lines.push(values.join("\t"));
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

function createMetadataArtifact(record: UploadRecord, reason: string): ChatArtifact {
  return {
    title: record.originalName,
    content: [
      `File: ${record.originalName}`,
      `Type: ${record.mimeType || "unknown"}`,
      `Mode: ${record.mode}`,
      `Size bytes: ${record.size}`,
      `Reason: ${reason}`
    ].join("\n")
  };
}

async function processSingleFile(record: UploadRecord, settings: Settings): Promise<FileContextBundle> {
  const extension = path.extname(record.originalName).toLowerCase();

  if (record.mode === "image") {
    if (!settings.swarm.allowImages || record.size > settings.swarm.maxInlineImageBytes) {
      return {
        artifacts: [createMetadataArtifact(record, "Image stored successfully, but inline vision transfer is disabled or file is too large.")],
        inlineImages: []
      };
    }

    const buffer = await readFile(record.path);
    return {
      artifacts: [
        {
          title: record.originalName,
          content: [
            `Image: ${record.originalName}`,
            `Type: ${record.mimeType || "unknown"}`,
            `Size bytes: ${record.size}`,
            "The image is attached to the model request as an inline data URL."
          ].join("\n")
        }
      ],
      inlineImages: [
        {
          type: "image_url",
          image_url: {
            url: `data:${record.mimeType || "image/png"};base64,${buffer.toString("base64")}`
          }
        }
      ]
    };
  }

  if (record.mode === "text") {
    const sampled = await sampleTextFile(record.path, record.size, settings.swarm.fileSamplingBytes);
    return {
      artifacts: [
        {
          title: record.originalName,
          content: [
            `File: ${record.originalName}`,
            `Type: ${record.mimeType || "text/plain"}`,
            `Sampled bytes limit: ${settings.swarm.fileSamplingBytes}`,
            "",
            sampled
          ].join("\n")
        }
      ],
      inlineImages: []
    };
  }

  if (record.mode === "document") {
    if (record.size > settings.swarm.maxDocumentReadBytes) {
      return {
        artifacts: [createMetadataArtifact(record, "Document is larger than the configured document parsing limit.")],
        inlineImages: []
      };
    }

    let extracted = "";

    if (extension === ".pdf") {
      extracted = await extractPdfText(record.path);
    } else if (extension === ".docx") {
      extracted = await extractDocxText(record.path);
    } else if (extension === ".xlsx" || extension === ".xlsm") {
      extracted = await extractSpreadsheetPreview(record.path);
    }

    if (!extracted) {
      return {
        artifacts: [createMetadataArtifact(record, "Document uploaded successfully. No specialized extractor is configured for this format.")],
        inlineImages: []
      };
    }

    const clipped = extracted.slice(0, settings.swarm.fileSamplingBytes * 2);

    return {
      artifacts: [
        {
          title: record.originalName,
          content: [
            `Document: ${record.originalName}`,
            `Type: ${record.mimeType || "application/octet-stream"}`,
            `Read bytes limit: ${settings.swarm.maxDocumentReadBytes}`,
            "",
            clipped
          ].join("\n")
        }
      ],
      inlineImages: []
    };
  }

  if (settings.swarm.allowBinaryMetadata) {
    return {
      artifacts: [
        createMetadataArtifact(
          record,
          "Binary, audio, or video file uploaded successfully. The swarm can reason over metadata and any user-provided instructions for it."
        )
      ],
      inlineImages: []
    };
  }

  return {
    artifacts: [],
    inlineImages: []
  };
}

export async function buildFileContext(records: UploadRecord[], settings: Settings): Promise<FileContextBundle> {
  const bundles = await Promise.all(records.map((record) => processSingleFile(record, settings)));
  return bundles.reduce<FileContextBundle>(
    (accumulator, bundle) => {
      accumulator.artifacts.push(...bundle.artifacts);
      accumulator.inlineImages.push(...bundle.inlineImages);
      return accumulator;
    },
    { artifacts: [], inlineImages: [] }
  );
}
