import type { Agent, AgentFunction } from "@prisma/client";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import openrouter, { DEFAULT_MODEL } from "@/lib/openrouter";
import {
  defaultSamplingParameters,
  defaultSwarmParameters,
  type SamplingParameters,
  type SwarmParameters,
} from "@/types/agent";

export interface SwarmEvent {
  type: "token" | "message" | "handoff" | "debug" | "done" | "error";
  payload: unknown;
}

export interface SwarmRunInput {
  agent: AgentWithFunctions;
  messages: ChatCompletionMessageParam[];
  availableAgents: AgentWithFunctions[];
}

export type AgentWithFunctions = Agent & { functions: AgentFunction[] };

export function pickHandoffTarget(
  agent: AgentWithFunctions,
  userText: string,
  availableAgents: AgentWithFunctions[],
) {
  const swarm = (agent.swarm as SwarmParameters | null) ?? defaultSwarmParameters;
  if (!swarm.handoff_targets?.length) return null;

  const target = swarm.handoff_targets.find((targetName) =>
    userText.toLowerCase().includes(targetName.toLowerCase()),
  );

  if (!target) return null;
  return availableAgents.find((candidate) => candidate.name === target) ?? null;
}

function buildToolsFromAgent(agent: AgentWithFunctions): ChatCompletionTool[] {
  const functions = Array.isArray(agent.functions) ? agent.functions : [];
  return functions
    .filter((fn) => typeof fn === "object" && fn !== null)
    .map((fn) => {
      const typed = fn as {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };

      return {
        type: "function",
        function: {
          name: typed.name,
          description: typed.description,
          parameters: typed.parameters ?? {
            type: "object",
            properties: {},
          },
        },
      };
    });
}

function resolveSampling(agent: AgentWithFunctions): SamplingParameters {
  return {
    ...defaultSamplingParameters,
    ...(agent.sampling as SamplingParameters | null),
  };
}

function resolveSwarm(agent: AgentWithFunctions): SwarmParameters {
  return {
    ...defaultSwarmParameters,
    ...(agent.swarm as SwarmParameters | null),
  };
}

export async function runSwarmOnce(input: SwarmRunInput) {
  const sampling = resolveSampling(input.agent);
  const swarm = resolveSwarm(input.agent);
  const tools = buildToolsFromAgent(input.agent);

  const completion = await openrouter.chat.completions.create({
    model: input.agent.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: input.agent.instructions },
      ...input.messages,
    ],
    temperature: sampling.temperature,
    top_p: sampling.top_p,
    frequency_penalty: sampling.frequency_penalty,
    presence_penalty: sampling.presence_penalty,
    max_tokens: sampling.max_tokens,
    seed: sampling.seed ?? undefined,
    stop: sampling.stop.length ? sampling.stop : undefined,
    tool_choice: swarm.tool_choice,
    parallel_tool_calls: swarm.parallel_tool_calls,
    tools: tools.length ? tools : undefined,
    response_format:
      sampling.response_format === "json_object" ? { type: "json_object" } : undefined,
  });

  return completion;
}

export async function* runSwarmStream(input: SwarmRunInput): AsyncGenerator<SwarmEvent> {
  const sampling = resolveSampling(input.agent);
  const swarm = resolveSwarm(input.agent);
  const tools = buildToolsFromAgent(input.agent);

  const userMessage = [...input.messages]
    .reverse()
    .find((message) => message.role === "user");
  const userText = typeof userMessage?.content === "string" ? userMessage.content : "";

  const handoffAgent = pickHandoffTarget(input.agent, userText, input.availableAgents);
  if (handoffAgent) {
    yield {
      type: "handoff",
      payload: {
        from: input.agent.name,
        to: handoffAgent.name,
      },
    };
    input = { ...input, agent: handoffAgent };
  }

  if (swarm.debug) {
    yield {
      type: "debug",
      payload: {
        agent: input.agent.name,
        model: input.agent.model,
        toolCount: tools.length,
      },
    };
  }

  const stream = await openrouter.chat.completions.create({
    model: input.agent.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: input.agent.instructions },
      ...input.messages,
    ],
    temperature: sampling.temperature,
    top_p: sampling.top_p,
    frequency_penalty: sampling.frequency_penalty,
    presence_penalty: sampling.presence_penalty,
    max_tokens: sampling.max_tokens,
    seed: sampling.seed ?? undefined,
    stop: sampling.stop.length ? sampling.stop : undefined,
    tool_choice: swarm.tool_choice,
    parallel_tool_calls: swarm.parallel_tool_calls,
    tools: tools.length ? tools : undefined,
    response_format:
      sampling.response_format === "json_object" ? { type: "json_object" } : undefined,
    stream: true,
  });

  let aggregated = "";
  for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) {
      aggregated += token;
      yield { type: "token", payload: token };
    }
  }

  yield {
    type: "message",
    payload: {
      content: aggregated,
      agent: input.agent.name,
      model: input.agent.model || DEFAULT_MODEL,
    },
  };

  yield { type: "done", payload: null };
}
