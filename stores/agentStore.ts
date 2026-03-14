import { create } from 'zustand';
import { Agent } from '@/types/agent';

interface AgentState {
  agents: Agent[];
  selectedAgentId: string | null;
  isLoading: boolean;

  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agentId: string | null) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  deleteAgent: (agentId: string) => void;
  setLoading: (loading: boolean) => void;
  getAgent: (agentId: string) => Agent | undefined;
  getActiveAgents: () => Agent[];
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agentId) => set({ selectedAgentId: agentId }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agentId ? { ...a, ...updates } : a)),
    })),
  deleteAgent: (agentId) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
      selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  getAgent: (agentId) => get().agents.find((a) => a.id === agentId),
  getActiveAgents: () => get().agents.filter((a) => a.isActive),
}));
