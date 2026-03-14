import type { Agent as DbAgent, UploadedFile as DbFile, Message as DbMessage } from "@prisma/client";
import type { Agent } from "@/types/agent";
import type { FileAttachment } from "@/types/file";
import type { ChatMessage } from "@/types/chat";

export function serializeAgent(agent: DbAgent): Agent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    instructions: agent.instructions,
    isActive: agent.isActive,
    avatar: agent.avatar,
    color: agent.color,
    sampling: agent.sampling as unknown as Agent["sampling"],
    swarm: agent.swarm as unknown as Agent["swarm"],
    functions: agent.functions as unknown as Agent["functions"],
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function serializeFile(file: DbFile): FileAttachment {
  return {
    id: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    status: file.status as FileAttachment["status"],
    createdAt: file.createdAt.toISOString(),
    metadata: (file.metadata || {}) as unknown as Record<string, unknown>,
  };
}

export function serializeMessage(message: DbMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role as ChatMessage["role"],
    content: message.content,
    agent: message.agent || undefined,
    agentColor: message.agentColor || undefined,
    timestamp: message.createdAt.toISOString(),
    metadata: (message.metadata || undefined) as unknown as ChatMessage["metadata"],
  };
}
