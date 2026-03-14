"use client";

import { create } from "zustand";
import type { Agent } from "@/types/agent";

interface AgentState {
  agents: Agent[];
  loading: boolean;
  activeAgentId: string | null;
  loadAgents: () => Promise<void>;
  setActiveAgentId: (id: string | null) => void;
  createAgent: (payload: Partial<Agent>) => Promise<Agent | null>;
  updateAgent: (id: string, payload: Partial<Agent>) => Promise<Agent | null>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  loading: false,
  activeAgentId: null,

  setActiveAgentId: (id) => set({ activeAgentId: id }),

  loadAgents: async () => {
    set({ loading: true });
    try {
      const response = await fetch("/api/agents");
      const data = (await response.json()) as Agent[];
      set({
        agents: data,
        activeAgentId: get().activeAgentId ?? data[0]?.id ?? null,
      });
    } finally {
      set({ loading: false });
    }
  },

  createAgent: async (payload) => {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const created = (await response.json()) as Agent;
    set((state) => ({ agents: [created, ...state.agents] }));
    return created;
  },

  updateAgent: async (id, payload) => {
    const response = await fetch(`/api/agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const updated = (await response.json()) as Agent;
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === id ? updated : agent)),
    }));
    return updated;
  },

  deleteAgent: async (id) => {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
    }));
  },
}));
