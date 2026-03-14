import {
  defaultSamplingParameters,
  defaultSwarmParameters,
  type SamplingParameters,
  type SwarmParameters,
} from "@/types/agent";

export interface GlobalSettings {
  api: {
    baseUrl: string;
    referer: string;
    title: string;
    timeoutMs: number;
    retryCount: number;
    retryDelay: number;
  };
  defaults: {
    model: string;
    sampling: SamplingParameters;
  };
  swarm: {
    initialAgentId: string | null;
    maxTurns: number | null;
    contextVariables: Record<string, unknown>;
    debug: boolean;
  };
  files: {
    maxFileSize: number;
    strategy: "full" | "chunked" | "summary" | "map-reduce";
    chunkSize: number;
    uploadDir: string;
    autoCleanupHours: number;
  };
  interface: {
    theme: "light" | "dark" | "system";
    language: "ru" | "en";
    fontSize: number;
    density: "comfortable" | "compact";
    showDebugInfo: boolean;
  };
}

export const defaultGlobalSettings: GlobalSettings = {
  api: {
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    referer: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    title: "KIMI Swarm Chat Service",
    timeoutMs: 90_000,
    retryCount: 3,
    retryDelay: 1000,
  },
  defaults: {
    model: process.env.OPENROUTER_DEFAULT_MODEL ?? "moonshotai/kimi-k2",
    sampling: defaultSamplingParameters,
  },
  swarm: {
    initialAgentId: null,
    maxTurns: null,
    contextVariables: {},
    debug: false,
  },
  files: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 10 * 1024 * 1024 * 1024),
    strategy: "map-reduce",
    chunkSize: 5 * 1024 * 1024,
    uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
    autoCleanupHours: 24,
  },
  interface: {
    theme: "dark",
    language: "ru",
    fontSize: 14,
    density: "comfortable",
    showDebugInfo: false,
  },
};

export function mergeSwarm(
  value: SwarmParameters | null | undefined,
): SwarmParameters {
  return { ...defaultSwarmParameters, ...(value ?? {}) };
}

export function mergeSampling(
  value: SamplingParameters | null | undefined,
): SamplingParameters {
  return { ...defaultSamplingParameters, ...(value ?? {}) };
}
