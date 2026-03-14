export interface FileAttachmentRef {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface ToolCallInfo {
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agent?: string;
  agentColor?: string;
  timestamp: string;
  attachments?: FileAttachmentRef[];
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
    handoffFrom?: string;
    handoffTo?: string;
    debug?: unknown;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}
