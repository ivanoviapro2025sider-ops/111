import { Agent } from '@/types/agent';
import { ChatMessage } from '@/types/chat';
import { createOpenRouterClient } from './openrouter';
import { parseJsonSafe } from './utils';

export interface SwarmResult {
  messages: ChatMessage[];
  agent: Agent;
  contextVariables: Record<string, unknown>;
}

export interface SwarmRunOptions {
  agent: Agent;
  messages: ChatMessage[];
  contextVariables?: Record<string, unknown>;
  allAgents?: Agent[];
  maxTurns?: number;
  debug?: boolean;
  stream?: boolean;
  apiKey?: string;
}

function interpolateInstructions(instructions: string, contextVariables: Record<string, unknown>): string {
  let result = instructions;
  for (const [key, value] of Object.entries(contextVariables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function buildTools(agent: Agent, allAgents: Agent[]) {
  const tools: Array<{
    type: 'function' as const;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> = [];

  const functions = parseJsonSafe<Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    isHandoff: boolean;
    handoffTarget?: string;
  }>>(JSON.stringify(agent.functions || []), []);

  for (const fn of functions) {
    tools.push({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters || { type: 'object', properties: {} },
      },
    });
  }

  const handoffTargetIds = parseJsonSafe<string[]>(
    typeof agent.handoffTargets === 'string' ? agent.handoffTargets : JSON.stringify(agent.handoffTargets || []),
    []
  );

  for (const targetId of handoffTargetIds) {
    const targetAgent = allAgents.find(a => a.id === targetId);
    if (targetAgent) {
      tools.push({
        type: 'function',
        function: {
          name: `transfer_to_${targetAgent.name.toLowerCase().replace(/\s+/g, '_')}`,
          description: `Transfer the conversation to ${targetAgent.name}: ${targetAgent.description}`,
          parameters: { type: 'object', properties: {} },
        },
      });
    }
  }

  return tools;
}

export async function runSwarm(options: SwarmRunOptions): Promise<SwarmResult> {
  const {
    agent: initialAgent,
    messages: initialMessages,
    contextVariables: initialContext = {},
    allAgents = [],
    maxTurns = 0,
    apiKey,
  } = options;

  const client = createOpenRouterClient(apiKey);
  let currentAgent = initialAgent;
  let contextVariables = { ...initialContext };
  const resultMessages: ChatMessage[] = [];
  let turn = 0;
  const effectiveMaxTurns = maxTurns > 0 ? maxTurns : 10;

  while (turn < effectiveMaxTurns) {
    turn++;

    const systemMessage = interpolateInstructions(currentAgent.instructions, contextVariables);
    const tools = buildTools(currentAgent, allAgents);

    const apiMessages = [
      { role: 'system' as const, content: systemMessage },
      ...initialMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
      ...resultMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    ];

    const params: Record<string, unknown> = {
      model: currentAgent.model,
      messages: apiMessages,
      temperature: currentAgent.temperature,
      top_p: currentAgent.topP,
      max_tokens: currentAgent.maxTokens,
    };

    if (currentAgent.frequencyPenalty !== 0) params.frequency_penalty = currentAgent.frequencyPenalty;
    if (currentAgent.presencePenalty !== 0) params.presence_penalty = currentAgent.presencePenalty;
    if (currentAgent.seed !== null && currentAgent.seed !== undefined) params.seed = currentAgent.seed;

    const stopSeq = parseJsonSafe<string[]>(
      typeof currentAgent.stop === 'string' ? currentAgent.stop : JSON.stringify(currentAgent.stop || []),
      []
    );
    if (stopSeq.length > 0) params.stop = stopSeq;

    if (currentAgent.responseFormat === 'json_object') {
      params.response_format = { type: 'json_object' };
    }

    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = currentAgent.toolChoice || 'auto';
    }

    const response = await client.chat.completions.create(params as Parameters<typeof client.chat.completions.create>[0]);

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: choice.message.content || '',
      agentName: currentAgent.name,
      agentColor: currentAgent.color,
      agentId: currentAgent.id,
      timestamp: new Date().toISOString(),
      metadata: {
        model: currentAgent.model,
        tokensUsed: response.usage?.total_tokens,
      },
    };

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      assistantMessage.toolCalls = choice.message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      let handedOff = false;
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function.name.startsWith('transfer_to_')) {
          const targetName = toolCall.function.name.replace('transfer_to_', '').replace(/_/g, ' ');
          const targetAgent = allAgents.find(a => a.name.toLowerCase().replace(/\s+/g, ' ') === targetName);
          if (targetAgent) {
            assistantMessage.metadata = {
              ...assistantMessage.metadata,
              handoffTo: targetAgent.name,
            };
            resultMessages.push(assistantMessage);
            currentAgent = targetAgent;
            handedOff = true;
            break;
          }
        }
      }

      if (handedOff) continue;
    }

    resultMessages.push(assistantMessage);

    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      break;
    }
  }

  return {
    messages: resultMessages,
    agent: currentAgent,
    contextVariables,
  };
}
