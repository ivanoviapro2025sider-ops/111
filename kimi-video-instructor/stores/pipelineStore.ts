import { create } from 'zustand';
import { PipelineState, PipelineStage, StageState, createInitialPipelineState } from '@/types/pipeline';

interface PipelineStore {
  state: PipelineState | null;
  isRunning: boolean;
  error: string | null;
  startPipeline: (projectId: string) => Promise<void>;
  updateStage: (stage: PipelineStage, stageState: StageState) => void;
  setError: (err: string | null) => void;
  reset: () => void;
  subscribeToStatus: (projectId: string) => () => void;
}

let eventSource: EventSource | null = null;

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  state: null,
  isRunning: false,
  error: null,

  startPipeline: async (projectId: string) => {
    set({ isRunning: true, error: null, state: createInitialPipelineState() });
    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline/start`, { method: 'POST' });
      if (!res.ok) throw new Error(res.statusText);
      get().subscribeToStatus(projectId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start pipeline', isRunning: false });
    }
  },

  updateStage: (stage: PipelineStage, stageState: StageState) => {
    set((s) => {
      if (!s.state) return s;
      return {
        state: {
          ...s.state,
          currentStage: stage,
          stages: { ...s.state.stages, [stage]: stageState },
        },
      };
    });
  },

  setError: (err) => set({ error: err }),

  reset: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ state: null, isRunning: false, error: null });
  },

  subscribeToStatus: (projectId: string) => {
    if (eventSource) eventSource.close();
    const url = `/api/projects/${projectId}/pipeline/status`;
    eventSource = new EventSource(url);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        set({ state: data, isRunning: data.completedAt ? false : true });
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      set({ isRunning: false });
      eventSource?.close();
      eventSource = null;
    };
    return () => {
      eventSource?.close();
      eventSource = null;
    };
  },
}));
