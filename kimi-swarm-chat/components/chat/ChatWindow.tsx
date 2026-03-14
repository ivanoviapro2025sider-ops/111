"use client";

import { useMemo } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { ChatSession } from "@/types/chat";

export function ChatWindow({ session }: { session?: ChatSession }) {
  const messages = useMemo(() => session?.messages ?? [], [session?.messages]);

  if (!session) {
    return (
      <section className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
        <p className="text-sm text-zinc-500">Выберите чат или создайте новый.</p>
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-col gap-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </section>
  );
}
