export type ResponseFormat = "text" | "json_object";
export type Verbosity = "low" | "medium" | "high" | "max";
export type ToolChoice = "none" | "auto" | "required";

export interface AgentSamplingConfig {
  temperature: number;
  top_p: number;
  top_k: number;
  frequency_penalty: number;
  presence_penalty: number;
  repetition_penalty: number;
  min_p: number;
  top_a: number;
  max_tokens: number;
  seed: number | null;
  stop: string[];
  response_format: ResponseFormat;
  verbosity: Verbosity;
}

export interface AgentSwarmConfig {
  max_turns: number | null;
  execute_tools: boolean;
  stream: boolean;
  debug: boolean;
  context_variables: Record<string, unknown>;
  handoff_targets: string[];
  handoff_conditions: string;
  tool_choice: ToolChoice;
  parallel_tool_calls: boolean;
}

export interface AgentFunction {
  id?: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
  isHandoff: boolean;
  handoffTarget?: string;
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
  samplingConfig: AgentSamplingConfig;
  swarmConfig: AgentSwarmConfig;
  functions: AgentFunction[];
}
