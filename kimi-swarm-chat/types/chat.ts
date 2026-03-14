import type { FileAttachment } from "./file";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMetadata {
  model: string;
  tokensUsed: number;
  processingTime: number;
  handoffFrom?: string;
  handoffTo?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  agent?: string;
  agentColor?: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  metadata?: ChatMetadata;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
