export type VerbosityLevel = "low" | "medium" | "high" | "max";
export type ResponseFormat = "text" | "json_object";
export type ToolChoice = "none" | "auto" | "required";

export interface SamplingParameters {
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
  verbosity: VerbosityLevel;
}

export interface SwarmParameters {
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
  sampling: SamplingParameters;
  swarm: SwarmParameters;
  functions: AgentFunction[];
  createdAt: string;
  updatedAt: string;
}

export const defaultSamplingParameters: SamplingParameters = {
  temperature: 1.0,
  top_p: 1.0,
  top_k: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1.0,
  min_p: 0,
  top_a: 0,
  max_tokens: 4096,
  seed: null,
  stop: [],
  response_format: "text",
  verbosity: "medium",
};

export const defaultSwarmParameters: SwarmParameters = {
  max_turns: null,
  execute_tools: true,
  stream: true,
  debug: false,
  context_variables: {},
  handoff_targets: [],
  handoff_conditions: "",
  tool_choice: "auto",
  parallel_tool_calls: true,
};
