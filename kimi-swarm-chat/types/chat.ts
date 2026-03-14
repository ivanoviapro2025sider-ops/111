import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  agent?: string;
  agentColor?: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolCalls?: ChatCompletionMessageToolCall[];
  isStreaming?: boolean;
  metadata?: {
    model: string;
    tokensUsed?: number;
    processingTime?: number;
    handoffFrom?: string;
    handoffTo?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatRequestPayload {
  chatId: string;
  agentId?: string;
  messages: ChatMessage[];
  stream?: boolean;
  attachments?: string[];
}
