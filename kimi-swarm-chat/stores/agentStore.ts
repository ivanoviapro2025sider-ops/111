"use client";

import { create } from "zustand";
import type { Agent } from "@/types/agent";

interface AgentStoreState {
  agents: Agent[];
  loading: boolean;
  error?: string;
  fetchAgents: () => Promise<void>;
  createAgent: (payload: Partial<Agent>) => Promise<Agent | undefined>;
  updateAgent: (id: string, payload: Partial<Agent>) => Promise<Agent | undefined>;
  deleteAgent: (id: string) => Promise<void>;
}

function normalize(raw: any): Agent {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
  };
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: [],
  loading: false,
  error: undefined,
  fetchAgents: async () => {
    set({ loading: true, error: undefined });
    try {
      const response = await fetch("/api/agents", { cache: "no-store" });
      const data = await response.json();
      set({ agents: data.map(normalize), loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load agents",
      });
    }
  },
  createAgent: async (payload) => {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      set({ error: await response.text() });
      return undefined;
    }
    const created = normalize(await response.json());
    set({ agents: [...get().agents, created] });
    return created;
  },
  updateAgent: async (id, payload) => {
    const response = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      set({ error: await response.text() });
      return undefined;
    }
    const updated = normalize(await response.json());
    set({
      agents: get().agents.map((agent) => (agent.id === id ? updated : agent)),
    });
    return updated;
  },
  deleteAgent: async (id) => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    set({ agents: get().agents.filter((agent) => agent.id !== id) });
  },
}));
