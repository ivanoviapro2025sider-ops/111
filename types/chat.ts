export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  processingTime?: number;
  handoffFrom?: string;
  handoffTo?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agent?: string;
  agentColor?: string;
  timestamp: string;
  attachments?: FileAttachment[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  metadata?: MessageMetadata;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  agentId?: string;
  chatId?: string;
  contextVariables?: Record<string, unknown>;
  attachmentIds?: string[];
}

export interface StreamEvent {
  type: 'content' | 'tool_call' | 'handoff' | 'error' | 'done';
  data: unknown;
  agent?: string;
  agentColor?: string;
}
