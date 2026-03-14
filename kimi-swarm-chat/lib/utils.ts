import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_SAMPLING_CONFIG = {
  temperature: 1,
  top_p: 1,
  top_k: 0,
  frequency_penalty: 0,
  presence_penalty: 0,
  repetition_penalty: 1,
  min_p: 0,
  top_a: 0,
  max_tokens: 4096,
  seed: null as number | null,
  stop: [] as string[],
  response_format: "text" as "text" | "json_object",
  verbosity: "medium" as "low" | "medium" | "high" | "max",
};

export const DEFAULT_SWARM_CONFIG = {
  max_turns: null as number | null,
  execute_tools: true,
  stream: true,
  debug: false,
  context_variables: {} as Record<string, unknown>,
  handoff_targets: [] as string[],
  handoff_conditions: "",
  tool_choice: "auto" as "none" | "auto" | "required",
  parallel_tool_calls: true,
};

export const DEFAULT_FILE_PROCESSING_CONFIG = {
  maxFileSize: 10 * 1024 * 1024 * 1024,
  defaultStrategy: "chunked",
  chunkSize: 10_000,
  chunkOverlap: 500,
  maxContextTokens: 16_000,
  uploadDir: "./uploads",
  cleanupEnabled: true,
};
