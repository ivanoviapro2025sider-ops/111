import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { runSwarmOnce, runSwarmStream } from "@/lib/swarm";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});

const requestSchema = z.object({
  chatId: z.string().optional(),
  agentId: z.string().optional(),
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().default(true),
  attachments: z.array(z.string()).default([]),
});

async function ensureChatSession(chatId?: string) {
  if (chatId) {
    const chat = await db.chatSession.findUnique({ where: { id: chatId } });
    if (chat) return chat;
  }

  return db.chatSession.create({
    data: { title: "New chat" },
  });
}

async function composeFileContext(fileIds: string[]) {
  if (!fileIds.length) return "";
  const files = await db.uploadedFile.findMany({
    where: { id: { in: fileIds } },
    orderBy: { updatedAt: "desc" },
  });
  if (!files.length) return "";

  return files
    .map((file) => {
      const excerpt = (file.processingOutput ?? "").slice(0, 8_000);
      return `\n[File: ${file.originalName}]\n${excerpt || "No processed content yet."}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const chat = await ensureChatSession(payload.chatId);

    const agents = await db.agent.findMany({
      where: { isActive: true },
      include: { functions: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!agents.length) {
      return NextResponse.json(
        { error: "No active agents configured. Create at least one agent first." },
        { status: 400 },
      );
    }

    const selectedAgent =
      agents.find((agent) => agent.id === payload.agentId) ?? agents[0];

    const fileContext = await composeFileContext(payload.attachments);
    const normalizedMessages = payload.messages.map((message, index, all) => {
      if (index === all.length - 1 && message.role === "user" && fileContext) {
        return {
          ...message,
          content: `${message.content}\n\nAttached context:\n${fileContext}`,
        };
      }
      return message;
    });

    const latest = normalizedMessages[normalizedMessages.length - 1];
    if (latest?.role === "user") {
      await db.chatMessage.create({
        data: {
          chatId: chat.id,
          role: "user",
          content: latest.content,
        },
      });

      if (chat.title === "New chat") {
        await db.chatSession.update({
          where: { id: chat.id },
          data: { title: latest.content.slice(0, 72) || "New chat" },
        });
      }
    }

    if (!payload.stream) {
      const completion = await runSwarmOnce({
        agent: selectedAgent,
        availableAgents: agents,
        messages: normalizedMessages,
      });
      const content = completion.choices[0]?.message?.content ?? "";

      const assistant = await db.chatMessage.create({
        data: {
          chatId: chat.id,
          role: "assistant",
          content,
          agent: selectedAgent.name,
          agentColor: selectedAgent.color,
          metadata: {
            model: selectedAgent.model,
            tokensUsed: completion.usage?.total_tokens,
          },
        },
      });

      return NextResponse.json({
        chatId: chat.id,
        message: assistant,
      });
    }

    const encoder = new TextEncoder();
    let finalMessage = "";
    let handoffMeta: { from?: string; to?: string } = {};
    let finalAgentName = selectedAgent.name;
    let finalAgentModel = selectedAgent.model;

    const stream = new ReadableStream({
      start(controller) {
        const write = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        void (async () => {
          try {
            for await (const event of runSwarmStream({
              agent: selectedAgent,
              availableAgents: agents,
              messages: normalizedMessages,
            })) {
              if (event.type === "token") {
                finalMessage += String(event.payload ?? "");
                write("token", event.payload);
              }
              if (event.type === "handoff") {
                const payloadData = event.payload as { from: string; to: string };
                handoffMeta = {
                  from: payloadData.from,
                  to: payloadData.to,
                };
                finalAgentName = payloadData.to;
                write("handoff", event.payload);
              }
              if (event.type === "debug") {
                write("debug", event.payload);
              }
              if (event.type === "message") {
                const payloadData = event.payload as {
                  model?: string;
                  agent?: string;
                };
                finalAgentModel = payloadData.model ?? finalAgentModel;
                finalAgentName = payloadData.agent ?? finalAgentName;
              }
            }

            const assistant = await db.chatMessage.create({
              data: {
                chatId: chat.id,
                role: "assistant",
                content: finalMessage,
                agent: finalAgentName,
                agentColor: selectedAgent.color,
                metadata: {
                  model: finalAgentModel,
                  handoffFrom: handoffMeta.from,
                  handoffTo: handoffMeta.to,
                },
              },
            });

            write("done", {
              chatId: chat.id,
              message: assistant,
            });
          } catch (error) {
            write("error", {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          } finally {
            controller.close();
          }
        })();
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
      { error: error instanceof Error ? error.message : "Invalid chat payload" },
      { status: 400 },
    );
  }
}
