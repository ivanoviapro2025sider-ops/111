export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
  isHandoff: boolean;
  handoffTarget?: string;
}

export interface SamplingParameters {
  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  repetitionPenalty: number;
  minP: number;
  topA: number;
  maxTokens: number;
  seed: number | null;
  stop: string[];
  responseFormat: 'text' | 'json_object';
}

export interface SwarmParameters {
  maxTurns: number;
  executeTools: boolean;
  stream: boolean;
  debug: boolean;
  contextVariables: Record<string, unknown>;
  handoffTargets: string[];
  handoffConditions: string;
  toolChoice: 'none' | 'auto' | 'required';
  parallelToolCalls: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  instructions: string;
  isActive: boolean;
  avatar: string;
  color: string;

  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  repetitionPenalty: number;
  minP: number;
  topA: number;
  maxTokens: number;
  seed: number | null;
  stop: string[];
  responseFormat: 'text' | 'json_object';

  maxTurns: number;
  executeTools: boolean;
  stream: boolean;
  debug: boolean;
  contextVariables: Record<string, unknown>;
  handoffTargets: string[];
  handoffConditions: string;
  toolChoice: 'none' | 'auto' | 'required';
  parallelToolCalls: boolean;

  functions: AgentFunction[];

  createdAt: string;
  updatedAt: string;
}

export type AgentCreateInput = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>;
export type AgentUpdateInput = Partial<AgentCreateInput>;
