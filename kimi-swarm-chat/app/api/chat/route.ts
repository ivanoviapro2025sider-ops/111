import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { db } from "@/lib/db";
import { createDefaultAgent } from "@/lib/defaults";
import openrouter from "@/lib/openrouter";
import { interpolateInstructions, resolveSwarm } from "@/lib/swarm";
import { DEFAULT_MODEL } from "@/lib/utils";
import type { ChatRequestPayload } from "@/types/chat";

export const runtime = "nodejs";

async function ensureAtLeastOneAgent() {
  const count = await db.agent.count();
  if (count > 0) return;
  const defaults = createDefaultAgent("Agent A");
  await db.agent.create({
    data: {
      ...defaults,
      sampling: defaults.sampling as unknown as Prisma.InputJsonValue,
      swarm: defaults.swarm as unknown as Prisma.InputJsonValue,
      functions: defaults.functions as unknown as Prisma.InputJsonValue,
    },
  });
}

function toModelMessages(
  instructions: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  fileContext: string,
): ChatCompletionMessageParam[] {
  const normalizedHistory: ChatCompletionMessageParam[] = history.map((item) => ({
    role:
      item.role === "assistant" || item.role === "system" ? item.role : "user",
    content: item.content,
  }));

  return [
    { role: "system", content: instructions },
    ...normalizedHistory,
    ...(fileContext ? [{ role: "system" as const, content: fileContext }] : []),
    { role: "user" as const, content: userMessage },
  ];
}

export async function POST(request: Request) {
  try {
    await ensureAtLeastOneAgent();

    const body = (await request.json()) as ChatRequestPayload;
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const agents = await db.agent.findMany({ orderBy: { createdAt: "asc" } });
    const chat = body.chatId
      ? await db.chatSession.findUnique({
          where: { id: body.chatId },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })
      : null;

    const chatSession =
      chat ??
      (await db.chatSession.create({
        data: {
          title: body.message.slice(0, 60),
          activeAgentId: body.agentId ?? agents[0]?.id,
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      }));

    const resolution = resolveSwarm({
      agents: agents as never[],
      activeAgentId: body.agentId ?? chatSession.activeAgentId ?? undefined,
      message: body.message,
      history: chatSession.messages.map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant" | "system" | "tool",
        content: message.content,
        timestamp: message.createdAt.toISOString(),
      })),
    });

    const activeAgent = resolution.activeAgent;
    const contextVariables = body.contextVariables ?? {};
    const instructions = interpolateInstructions(activeAgent.instructions, contextVariables);

    let fileContext = "";
    if (body.attachments?.length) {
      const files = await db.fileAsset.findMany({
        where: { id: { in: body.attachments } },
      });
      fileContext = files
        .map(
          (file) =>
            `File: ${file.originalName}\nSummary: ${file.summary ?? "N/A"}\nExtracted: ${
              file.extractedText?.slice(0, 2000) ?? ""
            }`,
        )
        .join("\n\n---\n\n");
    }

    await db.chatEntry.create({
      data: {
        chatId: chatSession.id,
        role: "user",
        content: body.message,
        attachments: (body.attachments ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    await db.chatSession.update({
      where: { id: chatSession.id },
      data: { activeAgentId: activeAgent.id },
    });

    const modelMessages = toModelMessages(
      instructions,
      chatSession.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      body.message,
      fileContext,
    );

    const streamResponse = body.stream ?? activeAgent.swarm.stream ?? true;
    const model = activeAgent.model || DEFAULT_MODEL;
    const startedAt = Date.now();
    const missingApiKey = !process.env.OPENROUTER_API_KEY;

    if (missingApiKey && !streamResponse) {
      const content =
        "OPENROUTER_API_KEY не настроен. Добавьте ключ на странице Settings или в .env.local.";
      const assistantEntry = await db.chatEntry.create({
        data: {
          chatId: chatSession.id,
          role: "assistant",
          content,
          agent: activeAgent.name,
          agentColor: activeAgent.color,
          metadata: {
            model,
            processingTime: Date.now() - startedAt,
            tokensUsed: 0,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json({ chatId: chatSession.id, message: assistantEntry });
    }

    if (!streamResponse) {
      const completion = await openrouter.chat.completions.create({
        model,
        messages: modelMessages,
        temperature: Number(activeAgent.sampling?.temperature ?? 1),
        top_p: Number(activeAgent.sampling?.top_p ?? 1),
        presence_penalty: Number(activeAgent.sampling?.presence_penalty ?? 0),
        frequency_penalty: Number(activeAgent.sampling?.frequency_penalty ?? 0),
        max_tokens: Number(activeAgent.sampling?.max_tokens ?? 4096),
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const assistantEntry = await db.chatEntry.create({
        data: {
          chatId: chatSession.id,
          role: "assistant",
          content,
          agent: activeAgent.name,
          agentColor: activeAgent.color,
          metadata: {
            model,
            processingTime: Date.now() - startedAt,
            tokensUsed: completion.usage?.total_tokens ?? 0,
            handoffFrom: resolution.handoffs[0]?.from,
            handoffTo: resolution.handoffs[0]?.to,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({ chatId: chatSession.id, message: assistantEntry });
    }

    const encoder = new TextEncoder();
    let assistantText = "";
    let tokenCount = 0;

    const completionStream = missingApiKey
      ? null
      : await openrouter.chat.completions.create({
      model,
      messages: modelMessages,
      stream: true,
      temperature: Number(activeAgent.sampling?.temperature ?? 1),
      top_p: Number(activeAgent.sampling?.top_p ?? 1),
      presence_penalty: Number(activeAgent.sampling?.presence_penalty ?? 0),
      frequency_penalty: Number(activeAgent.sampling?.frequency_penalty ?? 0),
      max_tokens: Number(activeAgent.sampling?.max_tokens ?? 4096),
    });

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown, event?: string) => {
          if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send(
          {
            chatId: chatSession.id,
            agent: { id: activeAgent.id, name: activeAgent.name, color: activeAgent.color },
          },
          "agent",
        );
        for (const handoff of resolution.handoffs) {
          send(handoff, "handoff");
        }

        try {
          if (!completionStream) {
            assistantText =
              "OPENROUTER_API_KEY не настроен. Добавьте ключ на странице Settings или в .env.local.";
            send({ type: "token", content: assistantText });
          } else {
            for await (const chunk of completionStream) {
              const delta = chunk.choices?.[0]?.delta?.content ?? "";
              if (!delta) continue;
              assistantText += delta;
              tokenCount += 1;
              send({ type: "token", content: delta });
            }
          }

          const message = await db.chatEntry.create({
            data: {
              chatId: chatSession.id,
              role: "assistant",
              content: assistantText,
              agent: activeAgent.name,
              agentColor: activeAgent.color,
              metadata: {
                model,
                processingTime: Date.now() - startedAt,
                tokensUsed: tokenCount,
                handoffFrom: resolution.handoffs[0]?.from,
                handoffTo: resolution.handoffs[0]?.to,
              } as unknown as Prisma.InputJsonValue,
            },
          });

          send({ type: "done", chatId: chatSession.id, messageId: message.id }, "done");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Streaming failed";
          send({ type: "error", message }, "error");
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
