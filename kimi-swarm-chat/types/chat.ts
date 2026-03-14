export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

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
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  agent?: string;
  agentColor?: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  metadata?: ChatMessageMetadata;
}
