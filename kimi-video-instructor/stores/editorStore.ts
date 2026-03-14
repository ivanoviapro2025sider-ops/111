import { create } from 'zustand';
import { Instruction, InstructionStep } from '@/types/instruction';
import { v4 as uuidv4 } from 'uuid';

interface EditorStore {
  instruction: Instruction | null;
  selectedStepIndex: number;
  isDirty: boolean;
  setInstruction: (inst: Instruction | null) => void;
  selectStep: (index: number) => void;
  updateStep: (stepId: string, updates: Partial<InstructionStep>) => void;
  addStep: (after: number) => void;
  removeStep: (stepId: string) => void;
  reorderSteps: (from: number, to: number) => void;
  saveInstruction: (projectId: string) => Promise<void>;
}

const createEmptyStep = (order: number): InstructionStep => ({
  id: uuidv4(),
  order,
  title: '',
  description: '',
  screenshot: { path: '', annotations: [] },
  timestamp: 0,
  timestampFormatted: '00:00',
  isManuallyEdited: false,
});

export const useEditorStore = create<EditorStore>((set, get) => ({
  instruction: null,
  selectedStepIndex: 0,
  isDirty: false,

  setInstruction: (inst) => set({ instruction: inst, selectedStepIndex: 0, isDirty: false }),

  selectStep: (index) => set({ selectedStepIndex: index }),

  updateStep: (stepId, updates) => {
    set((s) => {
      if (!s.instruction) return s;
      const steps = s.instruction.steps.map((st) =>
        st.id === stepId ? { ...st, ...updates, isManuallyEdited: true } : st
      );
      return { instruction: { ...s.instruction, steps }, isDirty: true };
    });
  },

  addStep: (after) => {
    set((s) => {
      if (!s.instruction) return s;
      const steps = [...s.instruction.steps];
      const newStep = createEmptyStep(after + 1);
      steps.splice(after + 1, 0, newStep);
      steps.forEach((st, i) => (st.order = i));
      return {
        instruction: { ...s.instruction, steps, totalSteps: steps.length },
        selectedStepIndex: after + 1,
        isDirty: true,
      };
    });
  },

  removeStep: (stepId) => {
    set((s) => {
      if (!s.instruction) return s;
      const steps = s.instruction.steps.filter((st) => st.id !== stepId);
      steps.forEach((st, i) => (st.order = i));
      const newIndex = Math.min(s.selectedStepIndex, Math.max(0, steps.length - 1));
      return {
        instruction: { ...s.instruction, steps, totalSteps: steps.length },
        selectedStepIndex: newIndex,
        isDirty: true,
      };
    });
  },

  reorderSteps: (from, to) => {
    set((s) => {
      if (!s.instruction) return s;
      const steps = [...s.instruction.steps];
      const [removed] = steps.splice(from, 1);
      steps.splice(to, 0, removed);
      steps.forEach((st, i) => (st.order = i));
      const newIndex = s.selectedStepIndex === from ? to : s.selectedStepIndex === to ? from : s.selectedStepIndex;
      return {
        instruction: { ...s.instruction, steps },
        selectedStepIndex: newIndex,
        isDirty: true,
      };
    });
  },

  saveInstruction: async (projectId) => {
    const { instruction } = get();
    if (!instruction) return;
    const res = await fetch(`/api/projects/${projectId}/instruction`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instruction),
    });
    if (!res.ok) throw new Error(res.statusText);
    set({ isDirty: false });
  },
}));
