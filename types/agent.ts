export interface AgentFunction {
  id?: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
  isHandoff: boolean;
  handoffTarget?: string;
}

export interface AgentSamplingParams {
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

export interface AgentSwarmParams {
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
  responseFormat: string;

  maxTurns: number;
  executeTools: boolean;
  stream: boolean;
  debug: boolean;
  contextVariables: Record<string, unknown>;
  handoffTargets: string[];
  handoffConditions: string;
  toolChoice: string;
  parallelToolCalls: boolean;

  functions: AgentFunction[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_AGENT: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  model: 'moonshotai/kimi-k2',
  instructions: '',
  isActive: true,
  avatar: 'bot',
  color: '#6366f1',
  temperature: 1.0,
  topP: 1.0,
  topK: 0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  repetitionPenalty: 1.0,
  minP: 0.0,
  topA: 0.0,
  maxTokens: 4096,
  seed: null,
  stop: [],
  responseFormat: 'text',
  maxTurns: 0,
  executeTools: true,
  stream: true,
  debug: false,
  contextVariables: {},
  handoffTargets: [],
  handoffConditions: '',
  toolChoice: 'auto',
  parallelToolCalls: true,
  functions: [],
};
