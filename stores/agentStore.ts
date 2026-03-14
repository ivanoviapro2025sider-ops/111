'use client';

import { create } from 'zustand';
import type { AgentConfig } from '@/types/agent';

interface AgentState {
  agents: AgentConfig[];
  isLoading: boolean;
  loadAgents: () => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  isLoading: false,
  loadAgents: async () => {
    set({ isLoading: true });
    const response = await fetch('/api/agents', { cache: 'no-store' });
    const data = await response.json();
    set({ agents: data.agents ?? [], isLoading: false });
  },
}));
