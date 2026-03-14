import type { Agent, AgentFunction } from '@/types/agent';
import type { ChatMessage, ToolCall, StreamChunk } from '@/types/chat';
import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { createOpenRouterClient } from './openrouter';

interface SwarmContext {
  variables: Record<string, unknown>;
  currentAgent: Agent;
  agents: Agent[];
  history: ChatMessage[];
  turns: number;
}

function buildSystemMessage(agent: Agent, variables: Record<string, unknown>): string {
  let instructions = agent.instructions;
  for (const [key, value] of Object.entries(variables)) {
    instructions = instructions.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return instructions;
}

function buildTools(agent: Agent) {
  const functions: AgentFunction[] = typeof agent.functions === 'string'
    ? JSON.parse(agent.functions)
    : agent.functions || [];

  return functions.map((fn) => ({
    type: 'function' as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters || { type: 'object', properties: {} },
    },
  }));
}

async function executeFunction(
  fn: AgentFunction,
  args: Record<string, unknown>,
  context: SwarmContext
): Promise<{ result: string; newAgent?: Agent }> {
  if (fn.isHandoff && fn.handoffTarget) {
    const targetAgent = context.agents.find(
      (a) => a.id === fn.handoffTarget || a.name === fn.handoffTarget
    );
    if (targetAgent) {
      return {
        result: `Handing off to ${targetAgent.name}`,
        newAgent: targetAgent,
      };
    }
    return { result: `Handoff target "${fn.handoffTarget}" not found` };
  }

  try {
    const asyncFn = new Function(
      'args',
      'context',
      `return (async () => { ${fn.implementation} })()`
    );
    const result = await asyncFn(args, context.variables);
    return { result: typeof result === 'string' ? result : JSON.stringify(result) };
  } catch (error) {
    return { result: `Function error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function* runSwarm(
  message: string,
  agent: Agent,
  agents: Agent[],
  history: ChatMessage[],
  contextVariables: Record<string, unknown> = {},
  fileContents?: string
): AsyncGenerator<StreamChunk> {
  const maxTurns = agent.maxTurns || 100;

  const context: SwarmContext = {
    variables: { ...contextVariables, ...(typeof agent.contextVariables === 'string' ? JSON.parse(agent.contextVariables) : agent.contextVariables || {}) },
    currentAgent: agent,
    agents,
    history: [...history],
    turns: 0,
  };

  const client = createOpenRouterClient();

  while (context.turns < maxTurns) {
    context.turns++;
    const currentAgent = context.currentAgent;

    const messages: Array<{ role: string; content: string }> = [];

    const systemMsg = buildSystemMessage(currentAgent, context.variables);
    if (systemMsg) {
      messages.push({ role: 'system', content: systemMsg });
    }

    for (const msg of context.history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    let userContent = message;
    if (fileContents) {
      userContent = `${message}\n\n--- Attached file content ---\n${fileContents}`;
    }
    messages.push({ role: 'user', content: userContent });

    const tools = buildTools(currentAgent);
    const requestParams: Record<string, unknown> = {
      model: currentAgent.model || 'moonshotai/kimi-k2',
      messages,
      temperature: currentAgent.temperature,
      top_p: currentAgent.topP,
      max_tokens: currentAgent.maxTokens,
      stream: currentAgent.stream !== false,
    };

    if (currentAgent.topK > 0) requestParams.top_k = currentAgent.topK;
    if (currentAgent.frequencyPenalty !== 0) requestParams.frequency_penalty = currentAgent.frequencyPenalty;
    if (currentAgent.presencePenalty !== 0) requestParams.presence_penalty = currentAgent.presencePenalty;
    if (currentAgent.seed !== null && currentAgent.seed !== undefined) requestParams.seed = currentAgent.seed;
    if (tools.length > 0) {
      requestParams.tools = tools;
      requestParams.tool_choice = currentAgent.toolChoice || 'auto';
    }
    if (currentAgent.responseFormat === 'json_object') {
      requestParams.response_format = { type: 'json_object' };
    }

    const stop = typeof currentAgent.stop === 'string' ? JSON.parse(currentAgent.stop) : currentAgent.stop;
    if (stop && stop.length > 0) requestParams.stop = stop;

    try {
      if (currentAgent.stream !== false) {
        const stream = await client.chat.completions.create({
          ...requestParams,
          stream: true,
        } as unknown as Parameters<typeof client.chat.completions.create>[0]) as unknown as Stream<ChatCompletionChunk>;

        let fullContent = '';
        const toolCallsAccum: Record<string, { id: string; name: string; args: string }> = {};

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullContent += delta.content;
            yield {
              type: 'content',
              content: delta.content,
              agentName: currentAgent.name,
              agentColor: currentAgent.color,
            };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = String(tc.index);
              if (!toolCallsAccum[idx]) {
                toolCallsAccum[idx] = {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  args: '',
                };
              }
              if (tc.id) toolCallsAccum[idx].id = tc.id;
              if (tc.function?.name) toolCallsAccum[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallsAccum[idx].args += tc.function.arguments;
            }
          }
        }

        const toolCalls = Object.values(toolCallsAccum);
        if (toolCalls.length > 0 && currentAgent.executeTools !== false) {
          const functions: AgentFunction[] = typeof currentAgent.functions === 'string'
            ? JSON.parse(currentAgent.functions)
            : currentAgent.functions || [];

          for (const tc of toolCalls) {
            yield {
              type: 'tool_call',
              toolCall: { id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } },
              agentName: currentAgent.name,
              agentColor: currentAgent.color,
            };

            const fn = functions.find((f) => f.name === tc.name);
            if (fn) {
              let parsedArgs = {};
              try { parsedArgs = JSON.parse(tc.args); } catch { /* empty */ }

              const { result, newAgent } = await executeFunction(fn, parsedArgs, context);

              if (newAgent) {
                yield {
                  type: 'handoff',
                  handoffFrom: currentAgent.name,
                  handoffTo: newAgent.name,
                  agentName: newAgent.name,
                  agentColor: newAgent.color,
                };
                context.currentAgent = newAgent;
                context.history.push(
                  { id: '', role: 'assistant', content: fullContent, agentName: currentAgent.name, timestamp: new Date().toISOString() },
                  { id: '', role: 'tool', content: result, timestamp: new Date().toISOString() }
                );
                continue;
              }

              context.history.push(
                { id: '', role: 'assistant', content: fullContent, agentName: currentAgent.name, timestamp: new Date().toISOString() },
                { id: '', role: 'tool', content: result, timestamp: new Date().toISOString() }
              );
            }
          }

          if (context.currentAgent.id !== currentAgent.id) {
            continue;
          }
        }

        yield {
          type: 'done',
          agentName: currentAgent.name,
          agentColor: currentAgent.color,
          metadata: {
            model: currentAgent.model,
          },
        };
        return;
      } else {
        const response = await client.chat.completions.create(
          requestParams as unknown as Parameters<typeof client.chat.completions.create>[0]
        );

        const choice = (response as { choices: Array<{ message: { content: string | null }; finish_reason: string }> }).choices[0];
        if (choice.message.content) {
          yield {
            type: 'content',
            content: choice.message.content,
            agentName: currentAgent.name,
            agentColor: currentAgent.color,
          };
        }

        yield {
          type: 'done',
          agentName: currentAgent.name,
          agentColor: currentAgent.color,
          metadata: {
            model: currentAgent.model,
            tokensUsed: (response as unknown as { usage?: { total_tokens: number } }).usage?.total_tokens,
          },
        };
        return;
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      return;
    }
  }

  yield {
    type: 'done',
    agentName: context.currentAgent.name,
    metadata: { model: context.currentAgent.model },
  };
}
