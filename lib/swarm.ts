import { Agent } from '@/types/agent';
import { ChatMessage } from '@/types/chat';
import { createOpenRouterClient } from './openrouter';

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
  onStream?: (chunk: string, agent: Agent) => void;
  onHandoff?: (from: Agent, to: Agent) => void;
  onToolCall?: (name: string, args: string) => void;
}

function buildSystemPrompt(agent: Agent, contextVariables: Record<string, unknown>): string {
  let prompt = agent.instructions;
  for (const [key, value] of Object.entries(contextVariables)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return prompt;
}

function buildTools(agent: Agent, allAgents: Agent[]) {
  const tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> = [];

  const fns = typeof agent.functions === 'string' ? JSON.parse(agent.functions) : agent.functions;
  for (const fn of fns || []) {
    tools.push({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters || { type: 'object', properties: {} },
      },
    });
  }

  const handoffTargets = typeof agent.handoffTargets === 'string'
    ? JSON.parse(agent.handoffTargets)
    : agent.handoffTargets;

  for (const targetId of handoffTargets || []) {
    const target = allAgents.find((a) => a.id === targetId);
    if (target) {
      tools.push({
        type: 'function',
        function: {
          name: `transfer_to_${target.name.replace(/\s+/g, '_').toLowerCase()}`,
          description: `Transfer the conversation to ${target.name}: ${target.description}`,
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
    maxTurns = 10,
    debug = false,
    onStream,
    onHandoff,
    onToolCall,
  } = options;

  let currentAgent = initialAgent;
  let contextVariables = { ...initialContext };
  const resultMessages: ChatMessage[] = [...initialMessages];
  let turnsLeft = maxTurns;

  while (turnsLeft > 0) {
    turnsLeft--;

    const client = createOpenRouterClient();
    const systemPrompt = buildSystemPrompt(currentAgent, contextVariables);
    const tools = buildTools(currentAgent, allAgents);

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...resultMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
      })),
    ];

    const requestParams: Record<string, unknown> = {
      model: currentAgent.model || 'moonshotai/kimi-k2',
      messages: apiMessages,
      temperature: currentAgent.temperature,
      top_p: currentAgent.topP,
      max_tokens: currentAgent.maxTokens,
      stream: currentAgent.stream && !!onStream,
    };

    if (currentAgent.frequencyPenalty !== 0) requestParams.frequency_penalty = currentAgent.frequencyPenalty;
    if (currentAgent.presencePenalty !== 0) requestParams.presence_penalty = currentAgent.presencePenalty;
    if (currentAgent.seed !== null && currentAgent.seed !== undefined) requestParams.seed = currentAgent.seed;
    if (currentAgent.stop && (typeof currentAgent.stop === 'string' ? JSON.parse(currentAgent.stop) : currentAgent.stop).length > 0) {
      requestParams.stop = typeof currentAgent.stop === 'string' ? JSON.parse(currentAgent.stop) : currentAgent.stop;
    }
    if (tools.length > 0) {
      requestParams.tools = tools;
      requestParams.tool_choice = currentAgent.toolChoice || 'auto';
    }

    if (debug) {
      console.log('[Swarm] Agent:', currentAgent.name, '| Turn:', maxTurns - turnsLeft);
      console.log('[Swarm] Tools:', tools.map((t) => t.function.name));
    }

    try {
      if (requestParams.stream) {
        const stream = await client.chat.completions.create(requestParams as unknown as Parameters<typeof client.chat.completions.create>[0]);
        let fullContent = '';
        let toolCallsAcc: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

        for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }> }>) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onStream?.(delta.content, currentAgent);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsAcc[tc.index]) {
                toolCallsAcc[tc.index] = {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: tc.function?.name || '', arguments: '' },
                };
              }
              if (tc.id) toolCallsAcc[tc.index].id = tc.id;
              if (tc.function?.name) toolCallsAcc[tc.index].function.name = tc.function.name;
              if (tc.function?.arguments) toolCallsAcc[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }

        if (toolCallsAcc.length > 0 && currentAgent.executeTools) {
          const assistantMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: fullContent,
            agent: currentAgent.name,
            agentColor: currentAgent.color,
            timestamp: new Date().toISOString(),
            toolCalls: toolCallsAcc,
          };
          resultMessages.push(assistantMsg);

          for (const tc of toolCallsAcc) {
            onToolCall?.(tc.function.name, tc.function.arguments);

            if (tc.function.name.startsWith('transfer_to_')) {
              const targetName = tc.function.name.replace('transfer_to_', '').replace(/_/g, ' ');
              const targetAgent = allAgents.find(
                (a) => a.name.toLowerCase().replace(/\s+/g, ' ') === targetName
              );
              if (targetAgent) {
                onHandoff?.(currentAgent, targetAgent);
                currentAgent = targetAgent;
                resultMessages.push({
                  id: Date.now().toString(),
                  role: 'tool',
                  content: JSON.stringify({ handoff: true, from: initialAgent.name, to: targetAgent.name }),
                  timestamp: new Date().toISOString(),
                  metadata: { handoffFrom: initialAgent.name, handoffTo: targetAgent.name },
                });
              }
            } else {
              resultMessages.push({
                id: Date.now().toString(),
                role: 'tool',
                content: JSON.stringify({ result: 'Function executed' }),
                timestamp: new Date().toISOString(),
              });
            }
          }
          continue;
        }

        resultMessages.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: fullContent,
          agent: currentAgent.name,
          agentColor: currentAgent.color,
          timestamp: new Date().toISOString(),
          metadata: { model: currentAgent.model },
        });
        break;
      } else {
        const response = await client.chat.completions.create(requestParams as unknown as Parameters<typeof client.chat.completions.create>[0]);
        const anyResponse = response as unknown as Record<string, unknown>;
        const choices = anyResponse.choices as Array<Record<string, unknown>>;
        const choiceMessage = choices[0].message as Record<string, unknown>;
        const message = {
          content: (choiceMessage.content as string) || '',
          tool_calls: choiceMessage.tool_calls as Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | undefined,
        };

        if (message.tool_calls && message.tool_calls.length > 0 && currentAgent.executeTools) {
          resultMessages.push({
            id: Date.now().toString(),
            role: 'assistant',
            content: message.content || '',
            agent: currentAgent.name,
            agentColor: currentAgent.color,
            timestamp: new Date().toISOString(),
            toolCalls: message.tool_calls,
          });

          for (const tc of message.tool_calls) {
            onToolCall?.(tc.function.name, tc.function.arguments);

            if (tc.function.name.startsWith('transfer_to_')) {
              const targetName = tc.function.name.replace('transfer_to_', '').replace(/_/g, ' ');
              const targetAgent = allAgents.find(
                (a) => a.name.toLowerCase().replace(/\s+/g, ' ') === targetName
              );
              if (targetAgent) {
                onHandoff?.(currentAgent, targetAgent);
                currentAgent = targetAgent;
                resultMessages.push({
                  id: Date.now().toString(),
                  role: 'tool',
                  content: JSON.stringify({ handoff: true, from: initialAgent.name, to: targetAgent.name }),
                  timestamp: new Date().toISOString(),
                  metadata: { handoffFrom: initialAgent.name, handoffTo: targetAgent.name },
                });
              }
            } else {
              resultMessages.push({
                id: Date.now().toString(),
                role: 'tool',
                content: JSON.stringify({ result: 'Function executed' }),
                timestamp: new Date().toISOString(),
              });
            }
          }
          continue;
        }

        resultMessages.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: message.content || '',
          agent: currentAgent.name,
          agentColor: currentAgent.color,
          timestamp: new Date().toISOString(),
          metadata: {
            model: currentAgent.model,
            tokensUsed: (response as { usage?: { total_tokens?: number } }).usage?.total_tokens,
          },
        });
        break;
      }
    } catch (error) {
      console.error('[Swarm] Error:', error);
      resultMessages.push({
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        agent: currentAgent.name,
        agentColor: currentAgent.color,
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }

  return { messages: resultMessages, agent: currentAgent, contextVariables };
}
