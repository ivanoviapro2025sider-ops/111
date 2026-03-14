import vm from "node:vm";
import type OpenAI from "openai";
import openrouter from "@/lib/openrouter";
import type { Agent, AgentFunction } from "@/types/agent";

export type SwarmEvent =
  | { type: "agent_start"; agent: Pick<Agent, "id" | "name" | "color" | "model"> }
  | { type: "token"; token: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown>; result?: unknown }
  | { type: "handoff"; from: string; to: string }
  | { type: "done"; content: string; activeAgentId: string }
  | { type: "error"; error: string };

export interface SwarmRunInput {
  agents: Agent[];
  activeAgentId: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  contextVariables?: Record<string, unknown>;
  maxTurns?: number;
  debug?: boolean;
}

function interpolateInstructions(
  instructions: string,
  context: Record<string, unknown> | undefined,
) {
  if (!context) return instructions;
  return instructions.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = context[key.trim()];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function toOpenAITool(fn: AgentFunction) {
  return {
    type: "function" as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  };
}

function extractTextDelta(
  chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
): string {
  return chunk.choices?.[0]?.delta?.content ?? "";
}

function getToolCalls(
  chunk: OpenAI.Chat.Completions.ChatCompletionChunk,
): OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[] {
  return chunk.choices?.[0]?.delta?.tool_calls ?? [];
}

async function executeFunction(
  fn: AgentFunction,
  args: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  const sandbox = {
    args,
    context,
    result: null as unknown,
    console: {
      log: (..._payload: unknown[]) => undefined,
    },
  };
  vm.createContext(sandbox);

  const wrapper = `
    "use strict";
    const __fn = async (args, context) => {
      ${fn.implementation}
    };
    result = await __fn(args, context);
  `;

  const script = new vm.Script(wrapper);
  await script.runInContext(sandbox, { timeout: 1_000 });
  return sandbox.result;
}

function pickAgent(agents: Agent[], activeAgentId: string) {
  return (
    agents.find((agent) => agent.id === activeAgentId && agent.isActive) ??
    agents.find((agent) => agent.isActive) ??
    agents[0]
  );
}

export async function* runSwarmStream({
  agents,
  activeAgentId,
  messages,
  contextVariables = {},
  maxTurns = 6,
}: SwarmRunInput): AsyncGenerator<SwarmEvent, void, unknown> {
  if (!agents.length) {
    yield { type: "error", error: "No agents configured." };
    return;
  }

  let currentAgent = pickAgent(agents, activeAgentId);
  if (!currentAgent) {
    yield { type: "error", error: "Unable to pick active agent." };
    return;
  }

  let currentMessages = [...messages];
  let fullResponse = "";
  let turns = 0;

  while (turns < maxTurns) {
    turns += 1;
    yield {
      type: "agent_start",
      agent: {
        id: currentAgent.id,
        name: currentAgent.name,
        color: currentAgent.color,
        model: currentAgent.model,
      },
    };

    const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: "system",
      content: interpolateInstructions(
        currentAgent.instructions,
        { ...currentAgent.swarmConfig.context_variables, ...contextVariables },
      ),
    };

    const tools = (currentAgent.functions || []).map(toOpenAITool);
    const stream = await openrouter.chat.completions.create({
      model: currentAgent.model,
      temperature: currentAgent.samplingConfig.temperature,
      top_p: currentAgent.samplingConfig.top_p,
      frequency_penalty: currentAgent.samplingConfig.frequency_penalty,
      presence_penalty: currentAgent.samplingConfig.presence_penalty,
      max_tokens: currentAgent.samplingConfig.max_tokens,
      stop: currentAgent.samplingConfig.stop.length
        ? currentAgent.samplingConfig.stop
        : undefined,
      tool_choice: currentAgent.swarmConfig.tool_choice,
      parallel_tool_calls: currentAgent.swarmConfig.parallel_tool_calls,
      tools: tools.length ? tools : undefined,
      stream: true,
      messages: [systemMessage, ...currentMessages],
    });

    let assistantContent = "";
    let pendingToolName = "";
    let pendingToolArgs = "";
    let hasToolCall = false;

    for await (const chunk of stream) {
      const token = extractTextDelta(chunk);
      if (token) {
        assistantContent += token;
        fullResponse += token;
        yield { type: "token", token };
      }

      const toolCalls = getToolCalls(chunk);
      for (const toolCall of toolCalls) {
        hasToolCall = true;
        if (toolCall.function?.name) {
          pendingToolName = toolCall.function.name;
        }
        if (toolCall.function?.arguments) {
          pendingToolArgs += toolCall.function.arguments;
        }
      }
    }

    if (!hasToolCall || !pendingToolName) {
      yield {
        type: "done",
        content: assistantContent || fullResponse,
        activeAgentId: currentAgent.id,
      };
      return;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = pendingToolArgs ? JSON.parse(pendingToolArgs) : {};
    } catch {
      parsedArgs = { raw: pendingToolArgs };
    }

    const targetFn = currentAgent.functions.find((item) => item.name === pendingToolName);
    if (!targetFn) {
      yield { type: "error", error: `Tool not found: ${pendingToolName}` };
      return;
    }

    const toolResult = await executeFunction(targetFn, parsedArgs, contextVariables);
    yield {
      type: "tool_call",
      name: pendingToolName,
      arguments: parsedArgs,
      result: toolResult,
    };

    if (targetFn.isHandoff && targetFn.handoffTarget) {
      const next = agents.find((agent) => agent.id === targetFn.handoffTarget && agent.isActive);
      if (next) {
        yield { type: "handoff", from: currentAgent.id, to: next.id };
        currentAgent = next;
      }
    }

    currentMessages = [
      ...currentMessages,
      {
        role: "assistant",
        content: assistantContent || `Tool call: ${pendingToolName}`,
      },
      {
        role: "tool",
        content: JSON.stringify(toolResult ?? {}),
        tool_call_id: `tool_${Date.now()}`,
      },
    ];
  }

  yield {
    type: "done",
    content: fullResponse,
    activeAgentId: currentAgent.id,
  };
}
