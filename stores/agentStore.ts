import { create } from 'zustand';
import { Agent, DEFAULT_AGENT } from '@/types/agent';

interface AgentState {
  agents: Agent[];
  currentAgentId: string | null;
  isLoading: boolean;

  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agentId: string | null) => void;
  setLoading: (loading: boolean) => void;
  fetchAgents: () => Promise<void>;
  createAgent: (agent: Partial<Agent>) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  getAgent: (id: string) => Agent | undefined;
  getActiveAgents: () => Agent[];
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  currentAgentId: null,
  isLoading: false,

  setAgents: (agents) => set({ agents }),
  setCurrentAgent: (agentId) => set({ currentAgentId: agentId }),
  setLoading: (loading) => set({ isLoading: loading }),

  fetchAgents: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        set({ agents: data });
        if (data.length > 0 && !get().currentAgentId) {
          set({ currentAgentId: data[0].id });
        }
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  createAgent: async (agentData: Partial<Agent>) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_AGENT, ...agentData }),
    });
    if (!res.ok) throw new Error('Failed to create agent');
    const agent = await res.json();
    set((s) => ({ agents: [...s.agents, agent] }));
    return agent;
  },

  updateAgent: async (id: string, updates: Partial<Agent>) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update agent');
    const agent = await res.json();
    set((s) => ({
      agents: s.agents.map(a => a.id === id ? agent : a),
    }));
    return agent;
  },

  deleteAgent: async (id: string) => {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete agent');
    set((s) => ({
      agents: s.agents.filter(a => a.id !== id),
      currentAgentId: s.currentAgentId === id ? null : s.currentAgentId,
    }));
  },

  getAgent: (id: string) => get().agents.find(a => a.id === id),
  getActiveAgents: () => get().agents.filter(a => a.isActive),
}));
