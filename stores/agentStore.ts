'use client';

import { create } from 'zustand';
import type { Agent, AgentCreateInput, AgentUpdateInput } from '@/types/agent';

interface AgentStore {
  agents: Agent[];
  selectedAgent: Agent | null;
  isLoading: boolean;

  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setLoading: (loading: boolean) => void;
  fetchAgents: () => Promise<void>;
  createAgent: (input: AgentCreateInput) => Promise<Agent>;
  updateAgent: (id: string, input: AgentUpdateInput) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  getActiveAgents: () => Agent[];
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  selectedAgent: null,
  isLoading: false,

  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchAgents: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        set({ agents: data });
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createAgent: async (input) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to create agent');
    const agent = await res.json();
    set((state) => ({ agents: [...state.agents, agent] }));
    return agent;
  },

  updateAgent: async (id, input) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update agent');
    const agent = await res.json();
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? agent : a)),
      selectedAgent: state.selectedAgent?.id === id ? agent : state.selectedAgent,
    }));
    return agent;
  },

  deleteAgent: async (id) => {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete agent');
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
    }));
  },

  getActiveAgents: () => get().agents.filter((a) => a.isActive),
}));
