export interface AgentFunctionInput {
  id?: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
  isHandoff: boolean;
  handoffTarget?: string | null;
}

export interface AgentConfig {
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
  verbosity: 'low' | 'medium' | 'high' | 'max';
  maxTurns: number | null;
  executeTools: boolean;
  stream: boolean;
  debug: boolean;
  contextVariables: Record<string, unknown>;
  handoffTargetIds: string[];
  handoffConditions: string;
  toolChoice: 'none' | 'auto' | 'required';
  parallelToolCalls: boolean;
  functions: AgentFunctionInput[];
  createdAt?: string;
  updatedAt?: string;
}
