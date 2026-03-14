import type { Agent } from "@/types/agent";
import type { FileAttachment } from "@/types/file";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessageMetadata {
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
  metadata?: Partial<ChatMessageMetadata>;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeAgentId?: string;
  activeAgent?: Agent;
  messages: ChatMessage[];
}

export interface ChatRequestPayload {
  chatId?: string;
  agentId?: string;
  message: string;
  attachments?: string[];
  stream?: boolean;
  contextVariables?: Record<string, unknown>;
  debug?: boolean;
}
