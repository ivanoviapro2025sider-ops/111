import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSwarmStream } from "@/lib/swarm";
import { serializeMessage } from "@/lib/serializers";
import { defaultSampling, defaultSwarm } from "@/types/agent";

export const runtime = "nodejs";

function sse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  if (chatId) {
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    return NextResponse.json({
      data: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        messages: chat.messages.map(serializeMessage),
      },
    });
  }

  const chats = await db.chat.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json({
    data: chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      preview: chat.messages[0]?.content || "",
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    chatId?: string;
    message: string;
    agentId?: string;
    fileIds?: string[];
  };

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const chat =
    (body.chatId
      ? await db.chat.findUnique({ where: { id: body.chatId } })
      : null) ??
    (await db.chat.create({
      data: {
        title: body.message.slice(0, 72),
      },
    }));

  const allAgents = await db.agent.findMany({ orderBy: { updatedAt: "desc" } });
  const activeDbAgent =
    allAgents.find((a) => a.id === body.agentId) ??
    allAgents.find((a) => a.isActive) ??
    (await db.agent.create({
      data: {
        name: "Main Agent",
        description: "Default triage agent",
        model: process.env.OPENROUTER_DEFAULT_MODEL || "moonshotai/kimi-k2",
        instructions:
          "You are a helpful KIMI Swarm assistant. Answer in Russian by default unless user requests otherwise.",
        isActive: true,
        avatar: "🤖",
        color: "#6366f1",
        sampling: defaultSampling as object,
        swarm: defaultSwarm as object,
        functions: [] as object,
      },
    }));

  const activeAgent = {
    ...activeDbAgent,
    sampling: activeDbAgent.sampling as typeof defaultSampling,
    swarm: activeDbAgent.swarm as typeof defaultSwarm,
    functions: activeDbAgent.functions as unknown[],
    createdAt: activeDbAgent.createdAt.toISOString(),
    updatedAt: activeDbAgent.updatedAt.toISOString(),
  };

  const handoffAgents = allAgents
    .filter((agent) => agent.id !== activeDbAgent.id)
    .map((agent) => ({
      ...agent,
      sampling: agent.sampling as typeof defaultSampling,
      swarm: agent.swarm as typeof defaultSwarm,
      functions: agent.functions as unknown[],
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    }));

  await db.message.create({
    data: {
      chatId: chat.id,
      role: "user",
      content: body.message,
    },
  });

  const priorMessages = await db.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  let fileContext = "";
  if (body.fileIds?.length) {
    const files = await db.uploadedFile.findMany({
      where: { id: { in: body.fileIds } },
    });
    fileContext = files
      .map((file) => {
        const processing = (file.metadata as Record<string, unknown> | null)?.processing as
          | Record<string, unknown>
          | undefined;
        const summary =
          typeof processing?.summary === "string"
            ? processing.summary
            : `File ${file.originalName} (${file.mimeType}) is uploaded but not processed yet.`;
        return `${file.originalName}:\n${summary}`;
      })
      .join("\n\n");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      try {
        controller.enqueue(
          encoder.encode(
            sse("meta", {
              chatId: chat.id,
            }),
          ),
        );

        for await (const event of runSwarmStream({
          activeAgent,
          handoffAgents,
          userMessage: body.message,
          fileContext,
          messages: priorMessages.map(serializeMessage),
        })) {
          if (event.type === "token") {
            assistantText += String(event.payload.token || "");
          }
          controller.enqueue(encoder.encode(sse(event.type, event.payload)));
        }

        await db.message.create({
          data: {
            chatId: chat.id,
            role: "assistant",
            content: assistantText,
            agent: activeAgent.name,
            agentColor: activeAgent.color,
            metadata: {
              model: activeAgent.model,
            },
          },
        });
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            sse("error", {
              message: error instanceof Error ? error.message : "Unknown streaming error",
            }),
          ),
        );
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
}
