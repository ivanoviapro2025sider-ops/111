import { create } from 'zustand';
import { Project } from '@/types/project';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: Record<string, unknown>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      set({ projects: data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch projects', loading: false });
    }
  },

  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      set({ currentProject: data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch project', loading: false });
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.statusText);
      const project = await res.json();
      set((s) => ({ projects: [...s.projects, project], loading: false }));
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create project', loading: false });
      throw err;
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.statusText);
      const updated = await res.json();
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? updated : p)),
        currentProject: s.currentProject?.id === id ? updated : s.currentProject,
        loading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update project', loading: false });
      throw err;
    }
  },

  deleteProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.statusText);
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        currentProject: s.currentProject?.id === id ? null : s.currentProject,
        loading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete project', loading: false });
      throw err;
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),
}));
