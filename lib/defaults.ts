import type { Settings } from "@/lib/types";

export const defaultSettings: Settings = {
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseUrl: "https://openrouter.ai/api/v1",
    siteUrl: process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    siteName: process.env.OPENROUTER_SITE_NAME ?? "KIMI Swarm Studio",
    defaultModel: "moonshotai/kimi-k2",
    temperature: 0.4,
    topP: 0.9,
    maxTokens: 4000
  },
  swarm: {
    name: "KIMI Swarm",
    orchestrationMode: "hybrid",
    plannerModel: "moonshotai/kimi-k2",
    synthesisModel: "moonshotai/kimi-k2",
    maxWorkerIterations: 4,
    fileSamplingBytes: 512 * 1024,
    maxDocumentReadBytes: 12 * 1024 * 1024,
    maxInlineImageBytes: 4 * 1024 * 1024,
    allowImages: true,
    allowBinaryMetadata: true,
    agents: [
      {
        id: "researcher",
        name: "Researcher",
        goal: "Find supporting facts, edge cases, and related material in the files.",
        systemPrompt:
          "You are the Researcher agent in a KIMI swarm. Extract evidence, references, constraints, and potential ambiguities from the provided context.",
        model: "moonshotai/kimi-k2",
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 2500,
        useFileContext: true,
        enabled: true,
        tools: ["file-search", "summarization"]
      },
      {
        id: "analyst",
        name: "Analyst",
        goal: "Turn source material into structure, conclusions, and next steps.",
        systemPrompt:
          "You are the Analyst agent in a KIMI swarm. Produce structured reasoning, highlight risks, and convert source material into actionable findings.",
        model: "moonshotai/kimi-k2",
        temperature: 0.3,
        topP: 0.9,
        maxTokens: 3000,
        useFileContext: true,
        enabled: true,
        tools: ["classification", "summarization", "memory"]
      },
      {
        id: "critic",
        name: "Critic",
        goal: "Challenge assumptions and catch gaps before the final response.",
        systemPrompt:
          "You are the Critic agent in a KIMI swarm. Look for missing evidence, contradictions, hallucination risks, and operational concerns.",
        model: "moonshotai/kimi-k2",
        temperature: 0.1,
        topP: 0.8,
        maxTokens: 2200,
        useFileContext: true,
        enabled: true,
        tools: ["verification", "routing"]
      }
    ]
  }
};
