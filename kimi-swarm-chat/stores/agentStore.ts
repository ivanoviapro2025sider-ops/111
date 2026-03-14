"use client";

import { create } from "zustand";
import type { Agent } from "@/types/agent";

interface AgentState {
  agents: Agent[];
  loading: boolean;
  setAgents: (agents: Agent[]) => void;
  setLoading: (value: boolean) => void;
  upsertAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  loading: false,
  setAgents: (agents) => set({ agents }),
  setLoading: (loading) => set({ loading }),
  upsertAgent: (agent) =>
    set((state) => {
      const exists = state.agents.some((item) => item.id === agent.id);
      return {
        agents: exists
          ? state.agents.map((item) => (item.id === agent.id ? agent : item))
          : [agent, ...state.agents],
      };
    }),
  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id),
    })),
}));
