import type { Agent } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";

export interface HandoffEvent {
  from: string;
  to: string;
  reason: string;
}

export interface SwarmResolution {
  activeAgent: Agent;
  handoffs: HandoffEvent[];
  maxTurns: number;
}

export function interpolateInstructions(
  instructions: string,
  contextVariables: Record<string, unknown>,
) {
  return instructions.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = contextVariables[key.trim()];
    return value == null ? "" : String(value);
  });
}

function keywordScore(message: string, candidate: Agent) {
  const lowered = message.toLowerCase();
  let score = 0;
  if (lowered.includes(candidate.name.toLowerCase())) score += 3;
  if (candidate.description && lowered.includes(candidate.description.toLowerCase())) score += 2;
  if (lowered.includes("анализ") && candidate.name.toLowerCase().includes("anal")) score += 2;
  if (lowered.includes("write") && candidate.name.toLowerCase().includes("write")) score += 2;
  return score;
}

function pickHandoffTarget(
  message: string,
  availableTargets: Agent[],
): Agent | undefined {
  return availableTargets
    .map((agent) => ({ agent, score: keywordScore(message, agent) }))
    .sort((a, b) => b.score - a.score)[0]?.agent;
}

export function resolveSwarm({
  agents,
  activeAgentId,
  message,
  history,
}: {
  agents: Agent[];
  activeAgentId?: string;
  message: string;
  history: ChatMessage[];
}): SwarmResolution {
  const enabledAgents = agents.filter((agent) => agent.isActive);
  if (!enabledAgents.length) {
    throw new Error("No active agents configured.");
  }

  let activeAgent =
    enabledAgents.find((agent) => agent.id === activeAgentId) ?? enabledAgents[0];
  const handoffs: HandoffEvent[] = [];

  const maxTurns = activeAgent.swarm.max_turns ?? Number.POSITIVE_INFINITY;
  if (maxTurns <= 1) {
    return { activeAgent, handoffs, maxTurns };
  }

  const recentText = [...history.slice(-4).map((h) => h.content), message].join(" ");
  const targets = enabledAgents.filter((agent) =>
    activeAgent.swarm.handoff_targets.includes(agent.id),
  );
  const candidate = pickHandoffTarget(recentText, targets);

  if (candidate && candidate.id !== activeAgent.id) {
    handoffs.push({
      from: activeAgent.name,
      to: candidate.name,
      reason:
        activeAgent.swarm.handoff_conditions ||
        "Automatic handoff triggered by request semantics.",
    });
    activeAgent = candidate;
  }

  return { activeAgent, handoffs, maxTurns };
}
