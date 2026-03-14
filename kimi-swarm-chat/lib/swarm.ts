import type { Agent } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";
import { openrouter, hasOpenRouterKey } from "./openrouter";

export interface SwarmRunInput {
  activeAgent: Agent;
  handoffAgents: Agent[];
  messages: ChatMessage[];
  userMessage: string;
  fileContext?: string;
}

export interface SwarmEvent {
  type: "agent" | "token" | "handoff" | "done" | "debug" | "error";
  payload: Record<string, unknown>;
}

function shouldHandoff(agent: Agent, userMessage: string) {
  const text = userMessage.toLowerCase();
  if (!agent.swarm.handoff_targets.length) return false;
  if (text.includes("проанализируй") || text.includes("analyze")) return true;
  if (text.includes("summary") || text.includes("суммар")) return true;
  return false;
}

function resolveAgent(baseAgent: Agent, handoffAgents: Agent[], userMessage: string) {
  if (!shouldHandoff(baseAgent, userMessage)) return baseAgent;
  const target = handoffAgents.find((a) => baseAgent.swarm.handoff_targets.includes(a.id));
  return target ?? baseAgent;
}

function buildSystemPrompt(agent: Agent, fileContext?: string) {
  const contextPrefix = fileContext
    ? `\n\n[file_context]\n${fileContext.slice(0, 12000)}\n[/file_context]\n`
    : "";
  return `${agent.instructions}${contextPrefix}`;
}

export async function* runSwarmStream(
  input: SwarmRunInput,
): AsyncGenerator<SwarmEvent, string, void> {
  const selectedAgent = resolveAgent(
    input.activeAgent,
    input.handoffAgents,
    input.userMessage,
  );

  if (selectedAgent.id !== input.activeAgent.id) {
    yield {
      type: "handoff",
      payload: {
        from: input.activeAgent.name,
        to: selectedAgent.name,
      },
    };
  }

  yield {
    type: "agent",
    payload: {
      name: selectedAgent.name,
      color: selectedAgent.color,
      avatar: selectedAgent.avatar,
      model: selectedAgent.model,
    },
  };

  const model = selectedAgent.model || "moonshotai/kimi-k2";

  if (!hasOpenRouterKey()) {
    const fallbackText = `OPENROUTER_API_KEY не задан. Демонстрационный ответ от агента "${selectedAgent.name}":\n\nВы написали: "${input.userMessage}".\nПодключите API ключ в Settings для реального вызова модели ${model}.`;
    for (const token of fallbackText.split(" ")) {
      yield {
        type: "token",
        payload: { token: `${token} ` },
      };
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    yield { type: "done", payload: {} };
    return fallbackText;
  }

  const startedAt = Date.now();
  const stream = await openrouter.chat.completions.create({
    model,
    stream: true,
    temperature: selectedAgent.sampling.temperature,
    top_p: selectedAgent.sampling.top_p,
    max_tokens: selectedAgent.sampling.max_tokens,
    frequency_penalty: selectedAgent.sampling.frequency_penalty,
    presence_penalty: selectedAgent.sampling.presence_penalty,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(selectedAgent, input.fileContext),
      },
      ...input.messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content })) as {
        role: "user" | "assistant" | "system";
        content: string;
      }[],
      {
        role: "user",
        content: input.userMessage,
      },
    ],
  });

  let fullText = "";
  for await (const part of stream) {
    const token = part.choices[0]?.delta?.content ?? "";
    if (!token) continue;
    fullText += token;
    yield {
      type: "token",
      payload: { token },
    };
  }

  yield {
    type: "debug",
    payload: {
      processingTimeMs: Date.now() - startedAt,
      model,
    },
  };
  yield { type: "done", payload: {} };
  return fullText;
}
