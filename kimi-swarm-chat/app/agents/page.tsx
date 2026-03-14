"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AgentCard } from "@/components/agents/AgentCard";
import { useAgentStore } from "@/stores/agentStore";

export default function AgentsPage() {
  const { agents, loadAgents, deleteAgent, createAgent } = useAgentStore();

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  return (
    <main className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agents</h1>
        <button
          type="button"
          onClick={async () => {
            const created = await createAgent({
              name: `Agent ${agents.length + 1}`,
              description: "Main triage agent",
              model: "moonshotai/kimi-k2",
              instructions:
                "You are a helpful triage agent. Analyze requests and handoff to specialists when needed.",
              isActive: true,
              avatar: "🤖",
              color: "#6366f1",
              sampling: {
                temperature: 0.7,
                top_p: 0.9,
                top_k: 0,
                frequency_penalty: 0,
                presence_penalty: 0,
                repetition_penalty: 1,
                min_p: 0,
                top_a: 0,
                max_tokens: 4096,
                seed: null,
                stop: [],
                response_format: "text",
                verbosity: "medium",
              },
              swarm: {
                max_turns: null,
                execute_tools: true,
                stream: true,
                debug: false,
                context_variables: {},
                handoff_targets: [],
                handoff_conditions: "",
                tool_choice: "auto",
                parallel_tool_calls: true,
              },
              functions: [],
            });
            if (created) location.assign(`/agents/${created.id}`);
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
        >
          + New Agent
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onDelete={deleteAgent} />
        ))}
      </div>

      {!agents.length && (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
          <p className="mb-2">No agents configured.</p>
          <p>
            Create your first agent, then edit it on the detail page with full sampling, swarm
            and functions setup.
          </p>
          <Link href="/settings" className="mt-3 inline-block text-indigo-300">
            Open settings →
          </Link>
        </div>
      )}
    </main>
  );
}
