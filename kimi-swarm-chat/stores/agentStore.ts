"use client";

import { create } from "zustand";
import type { Agent } from "@/types/agent";

interface AgentStoreState {
  agents: Agent[];
  selectedAgentId: string | null;
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  setSelectedAgent: (id: string | null) => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: [],
  selectedAgentId: null,
  setAgents: (agents) =>
    set((state) => ({
      agents,
      selectedAgentId:
        state.selectedAgentId && agents.find((a) => a.id === state.selectedAgentId)
          ? state.selectedAgentId
          : agents[0]?.id ?? null,
    })),
  upsertAgent: (agent) =>
    set((state) => {
      const exists = state.agents.some((a) => a.id === agent.id);
      return {
        agents: exists
          ? state.agents.map((a) => (a.id === agent.id ? agent : a))
          : [...state.agents, agent],
      };
    }),
  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
    })),
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
}));
