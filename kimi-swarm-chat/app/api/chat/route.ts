import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runSwarmStream } from "@/lib/swarm";
import { DEFAULT_SAMPLING_CONFIG, DEFAULT_SWARM_CONFIG } from "@/lib/utils";

export const runtime = "nodejs";

const chatSchema = z.object({
  chatId: z.string().optional(),
  message: z.string().min(1),
  agentId: z.string().optional(),
  contextVariables: z.record(z.string(), z.unknown()).optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  debug: z.boolean().optional(),
});

async function ensureDefaultAgent() {
  const existing = await db.agent.findFirst({ where: { isActive: true } });
  if (existing) return existing;

  return db.agent.create({
    data: {
      name: "Agent A",
      description: "Main triage agent",
      model: process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2",
      instructions:
        "You are KIMI Swarm assistant. Answer clearly and route to specialist agents when needed.",
      isActive: true,
      avatar: "Bot",
      color: "#6366f1",
      samplingConfig: DEFAULT_SAMPLING_CONFIG,
      swarmConfig: DEFAULT_SWARM_CONFIG,
    },
  });
}

export async function POST(req: Request) {
  try {
    const payload = chatSchema.parse(await req.json());
    const defaultAgent = await ensureDefaultAgent();

    const chat =
      (payload.chatId &&
        (await db.chat.findUnique({
          where: { id: payload.chatId },
        }))) ||
      (await db.chat.create({
        data: {
          title: payload.message.slice(0, 64),
          activeAgentId: payload.agentId || defaultAgent.id,
        },
      }));

    await db.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content: payload.message,
        attachments: payload.attachments,
      },
    });

    const history = await db.message.findMany({
      where: { chatId: chat.id },
      orderBy: { timestamp: "asc" },
      take: 40,
    });

    const agents = await db.agent.findMany({
      where: { isActive: true },
      include: { functions: true },
    });

    const encoder = new TextEncoder();
    const startedAt = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        let responseContent = "";
        let responseAgentId = payload.agentId || defaultAgent.id;
        let handoffFrom: string | undefined;
        let handoffTo: string | undefined;
        const toolCalls: Array<Record<string, unknown>> = [];

        const push = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          for await (const event of runSwarmStream({
            agents: agents as never,
            activeAgentId: payload.agentId || defaultAgent.id,
            messages: history.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system" | "tool",
              content: msg.content,
            })),
            contextVariables: payload.contextVariables,
            debug: payload.debug,
          })) {
            if (event.type === "token") {
              responseContent += event.token;
            }
            if (event.type === "tool_call") {
              toolCalls.push({
                name: event.name,
                arguments: event.arguments,
                result: event.result,
              });
            }
            if (event.type === "handoff") {
              handoffFrom = event.from;
              handoffTo = event.to;
            }
            if (event.type === "done") {
              responseAgentId = event.activeAgentId;
              responseContent = event.content || responseContent;
            }

            push(event.type, event);
          }

          const responder = agents.find((agent) => agent.id === responseAgentId);
          await db.message.create({
            data: {
              chatId: chat.id,
              role: "assistant",
              content: responseContent,
              agent: responder?.name,
              agentColor: responder?.color,
              toolCalls: toolCalls.length ? toolCalls : undefined,
              metadata: {
                model: responder?.model || defaultAgent.model,
                tokensUsed: 0,
                processingTime: Date.now() - startedAt,
                handoffFrom,
                handoffTo,
              },
            },
          });

          await db.chat.update({
            where: { id: chat.id },
            data: { activeAgentId: responseAgentId },
          });

          push("final", { chatId: chat.id, activeAgentId: responseAgentId });
        } catch (error) {
          push("error", {
            message: error instanceof Error ? error.message : "Unknown chat failure",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Chat request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
