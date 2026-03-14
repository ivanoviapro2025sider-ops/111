export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
  progress?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  result?: string;
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
  agentId?: string;
  agentName?: string;
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
