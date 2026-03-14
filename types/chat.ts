export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  processingTime?: number;
  handoffFrom?: string;
  handoffTo?: string;
}

export interface FileAttachmentRef {
  id: string;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentName?: string;
  agentColor?: string;
  timestamp: string;
  attachments?: FileAttachmentRef[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  metadata?: MessageMetadata;
}

export interface Chat {
  id: string;
  title: string;
  agentId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  chatId?: string;
  message: string;
  agentName?: string;
  fileIds?: string[];
  contextVariables?: Record<string, unknown>;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'handoff' | 'done' | 'error';
  content?: string;
  agentName?: string;
  agentColor?: string;
  toolCall?: ToolCall;
  handoffFrom?: string;
  handoffTo?: string;
  metadata?: MessageMetadata;
  error?: string;
}
