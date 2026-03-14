import { DEFAULT_MODEL } from "@/lib/utils";
import { DEFAULT_SAMPLING, DEFAULT_SWARM, type Agent } from "@/types/agent";

export const DEFAULT_GLOBAL_SETTINGS = {
  api: {
    apiKey: "",
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    httpReferer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    xTitle: "KIMI Swarm Chat Service",
    timeout: 60000,
    retryCount: 3,
    retryDelay: 1000,
  },
  defaults: {
    model: DEFAULT_MODEL,
    sampling: DEFAULT_SAMPLING,
    swarm: {
      initialAgentId: "",
      maxTurns: 6,
      contextVariables: {},
      debug: false,
    },
  },
  files: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024,
    strategy: "chunked",
    chunkSize: 8000,
    chunkOverlap: 200,
    uploadDir: process.env.UPLOAD_DIR || "./uploads",
    autoCleanupHours: 24,
  },
  interface: {
    theme: "dark",
    language: "ru",
    fontSize: "md",
    density: "comfortable",
    showDebugInfo: false,
  },
};

export function createDefaultAgent(name = "Agent A"): Omit<Agent, "id" | "createdAt" | "updatedAt"> {
  return {
    name,
    description: "Main triage agent",
    model: DEFAULT_MODEL,
    instructions:
      "You are a helpful triage agent. Analyze user intent and produce concise useful output.",
    isActive: true,
    avatar: "Bot",
    color: "#6366f1",
    sampling: { ...DEFAULT_SAMPLING },
    swarm: { ...DEFAULT_SWARM },
    functions: [],
  };
}
