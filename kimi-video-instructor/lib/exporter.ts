import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import { Instruction, InstructionStep } from '@/types/instruction';
import { getExportDir } from './file-utils';

export type ExportFormat = 'md' | 'html' | 'pdf' | 'docx';

export interface ExportOptions {
  includeScreenshots: boolean;
  includeAnnotations: boolean;
  includeTimestamps: boolean;
  includeTips: boolean;
  includeTableOfContents: boolean;
  includeMetadata: boolean;
}

export async function exportInstruction(
  projectId: string,
  instruction: Instruction,
  format: ExportFormat,
  options: ExportOptions,
): Promise<string> {
  const exportDir = getExportDir(projectId);

  switch (format) {
    case 'md':
      return exportMarkdown(exportDir, instruction, options);
    case 'html':
      return exportHTML(exportDir, instruction, options);
    default:
      return exportMarkdown(exportDir, instruction, options);
  }
}

async function exportMarkdown(
  exportDir: string,
  instruction: Instruction,
  options: ExportOptions,
): Promise<string> {
  let md = `# ${instruction.title}\n\n`;
  md += `${instruction.description}\n\n`;
  md += `**Шагов:** ${instruction.totalSteps} | **Время чтения:** ~${instruction.estimatedReadTime} мин.\n\n`;

  if (options.includeMetadata) {
    md += `---\n`;
    md += `*Источник:* ${instruction.metadata.sourceVideo}\n`;
    md += `*Модель:* ${instruction.metadata.model}\n`;
    md += `*Дата:* ${new Date(instruction.metadata.generatedAt).toLocaleDateString('ru-RU')}\n\n`;
  }

  if (options.includeTableOfContents) {
    md += `## Оглавление\n\n`;
    for (const step of instruction.steps) {
      md += `${step.order}. [${step.title}](#шаг-${step.order})\n`;
    }
    md += `\n---\n\n`;
  }

  for (const step of instruction.steps) {
    md += `## ${step.title}\n\n`;

    if (options.includeTimestamps && step.timestampFormatted) {
      md += `*Таймкод: ${step.timestampFormatted}*\n\n`;
    }

    if (options.includeScreenshots && step.screenshot.path) {
      const imgName = path.basename(step.screenshot.path);
      md += `![${step.screenshot.caption || step.title}](../frames/${imgName})\n\n`;
    }

    md += `${step.description}\n\n`;

    if (options.includeTips && step.tips && step.tips.length > 0) {
      for (const tip of step.tips) {
        md += `> **Совет:** ${tip}\n\n`;
      }
    }

    if (options.includeTips && step.warnings && step.warnings.length > 0) {
      for (const warning of step.warnings) {
        md += `> **Предупреждение:** ${warning}\n\n`;
      }
    }

    md += `---\n\n`;
  }

  const filePath = path.join(exportDir, 'instruction.md');
  await writeFile(filePath, md, 'utf-8');
  return filePath;
}

async function exportHTML(
  exportDir: string,
  instruction: Instruction,
  options: ExportOptions,
): Promise<string> {
  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${instruction.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { color: #111; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; }
    img { max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 1rem 0; }
    .tip { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 0 4px 4px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; margin: 0.5rem 0; border-radius: 0 4px 4px 0; }
    .timestamp { color: #6b7280; font-size: 0.875rem; }
    .meta { color: #9ca3af; font-size: 0.8rem; margin-top: 2rem; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
  </style>
</head>
<body>
  <h1>${instruction.title}</h1>
  <p>${instruction.description}</p>
  <p><strong>Шагов:</strong> ${instruction.totalSteps} | <strong>Время чтения:</strong> ~${instruction.estimatedReadTime} мин.</p>
  <hr>
`;

  for (const step of instruction.steps) {
    html += `  <h2>${step.title}</h2>\n`;

    if (options.includeTimestamps) {
      html += `  <p class="timestamp">Таймкод: ${step.timestampFormatted}</p>\n`;
    }

    if (options.includeScreenshots && step.screenshot.path) {
      const imgName = path.basename(step.screenshot.path);
      html += `  <img src="../frames/${imgName}" alt="${step.screenshot.caption || step.title}">\n`;
    }

    html += `  <p>${step.description}</p>\n`;

    if (options.includeTips && step.tips) {
      for (const tip of step.tips) {
        html += `  <div class="tip"><strong>Совет:</strong> ${tip}</div>\n`;
      }
    }
    if (options.includeTips && step.warnings) {
      for (const w of step.warnings) {
        html += `  <div class="warning"><strong>Предупреждение:</strong> ${w}</div>\n`;
      }
    }

    html += `  <hr>\n`;
  }

  html += `</body></html>`;

  const filePath = path.join(exportDir, 'instruction.html');
  await writeFile(filePath, html, 'utf-8');
  return filePath;
}
