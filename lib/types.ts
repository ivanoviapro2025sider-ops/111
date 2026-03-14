import { z } from "zod";

export const agentToolOptions = [
  "file-search",
  "summarization",
  "classification",
  "vision",
  "routing",
  "verification",
  "memory"
] as const;

export const swarmAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  systemPrompt: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().int().min(128).max(64000),
  useFileContext: z.boolean(),
  enabled: z.boolean(),
  tools: z.array(z.enum(agentToolOptions))
});

export const settingsSchema = z.object({
  openRouter: z.object({
    apiKey: z.string(),
    baseUrl: z.string().url(),
    siteUrl: z.string().url(),
    siteName: z.string().min(1),
    defaultModel: z.string().min(1),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0).max(1),
    maxTokens: z.number().int().min(128).max(64000)
  }),
  swarm: z.object({
    name: z.string().min(1),
    orchestrationMode: z.enum(["sequential", "parallel", "hybrid"]),
    plannerModel: z.string().min(1),
    synthesisModel: z.string().min(1),
    maxWorkerIterations: z.number().int().min(1).max(12),
    fileSamplingBytes: z.number().int().min(65536).max(8 * 1024 * 1024),
    maxDocumentReadBytes: z.number().int().min(1024 * 1024).max(64 * 1024 * 1024),
    maxInlineImageBytes: z.number().int().min(256 * 1024).max(12 * 1024 * 1024),
    allowImages: z.boolean(),
    allowBinaryMetadata: z.boolean(),
    agents: z.array(swarmAgentSchema).min(1)
  })
});

export const uploadModeSchema = z.enum(["text", "document", "image", "audio", "video", "binary"]);

export const uploadRecordSchema = z.object({
  id: z.string().min(1),
  originalName: z.string().min(1),
  safeName: z.string().min(1),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  path: z.string().min(1),
  status: z.enum(["uploading", "ready", "failed"]),
  uploadedAt: z.string().min(1),
  expectedParts: z.number().int().positive(),
  mode: uploadModeSchema,
  receivedParts: z.array(z.number().int().nonnegative())
});

export const chatRequestSchema = z.object({
  prompt: z.string().min(1),
  uploadIds: z.array(z.string()).default([]),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .default([])
});

export type SwarmAgent = z.infer<typeof swarmAgentSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type UploadRecord = z.infer<typeof uploadRecordSchema>;
export type UploadMode = z.infer<typeof uploadModeSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatArtifact {
  title: string;
  content: string;
}

export interface ChatResult {
  answer: string;
  plan: string;
  workerOutputs: Array<{
    agentId: string;
    agentName: string;
    output: string;
  }>;
  files: ChatArtifact[];
}
