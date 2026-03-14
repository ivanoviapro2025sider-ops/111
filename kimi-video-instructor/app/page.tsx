'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film, Upload, FileVideo, Play, Settings2, Download, MessageSquare,
  CheckCircle2, Loader2, Circle, AlertCircle, Music, FileText, Image,
  Link2, Brain, FileOutput, Trash2, ChevronLeft, ChevronRight, Eye,
  EyeOff, Sparkles, Clock, Hash, ArrowRight, X, Search, Plus,
  RotateCcw, Zap, ChevronDown,
} from 'lucide-react';
import { cn, formatFileSize, formatDuration } from '@/lib/utils';
import {
  PipelineState, PipelineStage, PIPELINE_STAGES_ORDER, STAGE_LABELS,
  createInitialPipelineState,
} from '@/types/pipeline';
import { Project, DEFAULT_PROJECT_SETTINGS } from '@/types/project';
import { Instruction, InstructionStep } from '@/types/instruction';

type AppView = 'home' | 'upload' | 'processing' | 'editor' | 'settings';

const CHUNK_SIZE = 5 * 1024 * 1024;

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) setProjects(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const openProject = useCallback((p: Project) => {
    setCurrentProject(p);
    if (p.status === 'processing') setView('processing');
    else if (p.status === 'review' || p.status === 'completed') setView('editor');
    else setView('upload');
  }, []);

  const goHome = useCallback(() => {
    setView('home');
    setCurrentProject(null);
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="min-h-screen bg-[#060a14]">
      <Header
        view={view}
        onHome={goHome}
        onSettings={() => setView('settings')}
        projectName={currentProject?.name}
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-20 pt-4">
        {view === 'home' && (
          <HomeView
            projects={projects}
            loading={loading}
            onNewProject={() => setView('upload')}
            onOpenProject={openProject}
            onDeleteProject={async (id) => {
              await fetch(`/api/projects/${id}`, { method: 'DELETE' });
              fetchProjects();
            }}
          />
        )}
        {view === 'upload' && (
          <UploadView
            onProjectCreated={(p) => {
              setCurrentProject(p);
              setView('processing');
            }}
            onBack={goHome}
          />
        )}
        {view === 'processing' && currentProject && (
          <ProcessingView
            project={currentProject}
            onComplete={(p) => {
              setCurrentProject(p);
              setView('editor');
            }}
            onBack={goHome}
          />
        )}
        {view === 'editor' && currentProject && (
          <EditorView
            project={currentProject}
            onBack={goHome}
          />
        )}
        {view === 'settings' && (
          <SettingsView onBack={goHome} />
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════ HEADER ═══════════════════════ */

function Header({ view, onHome, onSettings, projectName }: {
  view: AppView;
  onHome: () => void;
  onSettings: () => void;
  projectName?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a14]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={onHome} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 glow-sm">
              <Film className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              KIMI Video<span className="text-blue-400">Instructor</span>
            </span>
          </button>
          {projectName && view !== 'home' && (
            <>
              <ChevronRight className="h-4 w-4 text-white/20" />
              <span className="text-sm text-white/50 max-w-[200px] truncate">{projectName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view !== 'settings' && (
            <button
              onClick={onSettings}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
            >
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════ HOME ═══════════════════════ */

function HomeView({ projects, loading, onNewProject, onOpenProject, onDeleteProject }: {
  projects: Project[];
  loading: boolean;
  onNewProject: () => void;
  onOpenProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      {projects.length === 0 && !loading ? (
        <EmptyState onNew={onNewProject} />
      ) : (
        <>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Мои проекты</h1>
              <p className="mt-1 text-sm text-white/40">{projects.length} {projects.length === 1 ? 'проект' : 'проектов'}</p>
            </div>
            <button
              onClick={onNewProject}
              className="flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Новый проект
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400/50" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} onOpen={onOpenProject} onDelete={onDeleteProject} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-slide-up">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 mb-6 glow">
        <Film className="h-10 w-10 text-blue-400" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        KIMI Video<span className="text-blue-400">Instructor</span>
      </h1>
      <p className="text-white/40 max-w-md text-center mb-8 leading-relaxed">
        Загрузите видеоурок или скринкаст, и ИИ создаст пошаговую инструкцию
        со скриншотами автоматически
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2.5 rounded-xl bg-blue-500 px-7 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:bg-blue-400 transition-all active:scale-95"
      >
        <Upload className="h-4 w-4" />
        Загрузить видео
      </button>
      <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-lg">
        {[
          { icon: FileVideo, label: 'Загрузите видео', sub: 'до 10 ГБ' },
          { icon: Brain, label: 'ИИ анализирует', sub: 'KIMI K2' },
          { icon: FileText, label: 'Получите инструкцию', sub: 'со скриншотами' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Icon className="h-5 w-5 text-white/30" />
            </div>
            <span className="text-xs font-medium text-white/60">{label}</span>
            <span className="text-[10px] text-white/25">{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  uploading:  { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Загрузка' },
  uploaded:   { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Готово к обработке' },
  processing: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Обработка' },
  review:     { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'На ревью' },
  completed:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Завершён' },
  error:      { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Ошибка' },
};

function ProjectCard({ project, index, onOpen, onDelete }: {
  project: Project; index: number;
  onOpen: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  const s = STATUS_STYLES[project.status] || STATUS_STYLES.uploaded;
  const inst = project.instruction;
  const steps = inst ? (typeof inst === 'string' ? JSON.parse(inst as string) : inst)?.totalSteps || 0 : 0;

  return (
    <div
      className="group glass glass-hover rounded-2xl p-5 cursor-pointer transition-all duration-200 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={() => onOpen(project)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
          <FileVideo className="h-5 w-5 text-white/30" />
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', s.bg, s.text)}>
          {s.label}
        </span>
      </div>
      <h3 className="font-semibold mb-1 truncate">{project.name || project.videoFileName}</h3>
      <p className="text-xs text-white/30 mb-4 truncate">{project.videoFileName}</p>
      <div className="flex items-center gap-4 text-[11px] text-white/25">
        {project.videoDuration > 0 && (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(project.videoDuration)}</span>
        )}
        {steps > 0 && (
          <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{steps} шагов</span>
        )}
        <span className="ml-auto">{new Date(project.createdAt).toLocaleDateString('ru-RU')}</span>
      </div>
      <button
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════ UPLOAD ═══════════════════════ */

function UploadView({ onProjectCreated, onBack }: {
  onProjectCreated: (p: Project) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('ru');
  const [style, setStyle] = useState('step_by_step');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('video/') && !f.name.match(/\.(mp4|avi|mkv|webm|mov|wmv|flv|m4v)$/i)) {
      setError('Пожалуйста, выберите видеофайл');
      return;
    }
    setFile(f);
    setError(null);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  }, [name]);

  const startUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name, fileSize: file.size, totalChunks,
          name: name || file.name, description,
        }),
      });
      if (!initRes.ok) throw new Error('Не удалось инициализировать загрузку');
      const { uploadId, projectId } = await initRes.json();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const fd = new FormData();
        fd.append('uploadId', uploadId);
        fd.append('chunkIndex', String(i));
        fd.append('chunk', chunk);
        await fetch('/api/upload/chunk', { method: 'POST', body: fd });
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, projectId, fileName: file.name, fileSize: file.size }),
      });
      if (!completeRes.ok) throw new Error('Ошибка завершения загрузки');

      const settings = {
        ...DEFAULT_PROJECT_SETTINGS,
        instructionLanguage: language,
        instructionStyle: style,
      };
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || file.name, description, status: 'uploaded', settings }),
      });

      const projRes = await fetch(`/api/projects/${projectId}`);
      const project = await projRes.json();
      onProjectCreated(project);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    }
  }, [file, name, description, language, style, onProjectCreated]);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Назад
      </button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Новый проект</h1>
        <p className="text-sm text-white/40">Загрузите видео и ИИ создаст пошаговую инструкцию</p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          'glass rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6',
          isDragging && 'border-blue-500/40 bg-blue-500/[0.03] glow',
          file && 'border-emerald-500/20 bg-emerald-500/[0.02]',
        )}
      >
        <input type="file" accept="video/*" className="hidden" id="vid-input"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <label htmlFor="vid-input" className="cursor-pointer flex flex-col items-center gap-4">
          {file ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                <FileVideo className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-white/30 mt-1">{formatFileSize(file.size)}</p>
              </div>
              <button className="text-xs text-white/30 hover:text-white/50 underline underline-offset-2"
                onClick={(e) => { e.preventDefault(); setFile(null); }}>
                Выбрать другой
              </button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                <Upload className="h-7 w-7 text-white/20" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/60">Перетащите видео сюда или нажмите</p>
                <p className="text-xs text-white/25 mt-1">MP4, AVI, MKV, WebM, MOV — до 10 ГБ</p>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs font-medium text-white/40 mb-1.5 block">Название проекта</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Например: Настройка CRM"
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 focus:glow-sm transition-all placeholder:text-white/15" />
        </div>
        <div>
          <label className="text-xs font-medium text-white/40 mb-1.5 block">Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="О чём это видео?"
            rows={2}
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 transition-all resize-none placeholder:text-white/15" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-white/40 mb-1.5 block">Язык инструкции</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none bg-transparent">
              <option value="ru" className="bg-[#0c1220]">Русский</option>
              <option value="en" className="bg-[#0c1220]">English</option>
              <option value="de" className="bg-[#0c1220]">Deutsch</option>
              <option value="fr" className="bg-[#0c1220]">Français</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/40 mb-1.5 block">Стиль</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none bg-transparent">
              <option value="step_by_step" className="bg-[#0c1220]">Пошаговый</option>
              <option value="technical" className="bg-[#0c1220]">Технический</option>
              <option value="narrative" className="bg-[#0c1220]">Нарративный</option>
              <option value="simplified" className="bg-[#0c1220]">Упрощённый</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="glass rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Загрузка...</span>
            <span className="text-sm text-blue-400 font-mono">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/25 mt-2">{formatFileSize(file!.size * progress / 100)} из {formatFileSize(file!.size)}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      <button
        onClick={startUpload}
        disabled={!file || uploading}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all active:scale-[0.98]',
          file && !uploading
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400'
            : 'bg-white/[0.04] text-white/20 cursor-not-allowed',
        )}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {uploading ? 'Загрузка...' : 'Загрузить и начать обработку'}
      </button>
    </div>
  );
}

/* ═══════════════════════ PROCESSING ═══════════════════════ */

const STAGE_ICONS: Record<PipelineStage, React.ComponentType<{ className?: string }>> = {
  upload: Upload, extractAudio: Music, transcribe: FileText,
  extractFrames: Image, align: Link2, analyze: Brain, generate: FileOutput,
};

function ProcessingView({ project, onComplete, onBack }: {
  project: Project;
  onComplete: (p: Project) => void;
  onBack: () => void;
}) {
  const [pipeline, setPipeline] = useState<PipelineState>(
    (project.pipelineState && typeof project.pipelineState === 'object'
      ? project.pipelineState
      : createInitialPipelineState()) as PipelineState,
  );
  const [started, setStarted] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (started) return;
    setStarted(true);
    fetch(`/api/projects/${project.id}/process`, { method: 'POST' }).catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`);
        if (!res.ok) return;
        const p = await res.json();
        if (p.pipelineState) {
          const ps = typeof p.pipelineState === 'string' ? JSON.parse(p.pipelineState) : p.pipelineState;
          setPipeline(ps);
        }
        if (p.status === 'review' || p.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          onComplete(p);
        }
        if (p.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [project.id, started, onComplete]);

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> К проектам
      </button>

      <div className="text-center mb-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 mx-auto mb-4 glow">
          <Brain className="h-8 w-8 text-violet-400 animate-pulse-soft" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Обработка видео</h1>
        <p className="text-sm text-white/40">{project.name}</p>
      </div>

      <div className="glass rounded-2xl p-6">
        {PIPELINE_STAGES_ORDER.map((stage, i) => {
          const state = pipeline.stages[stage];
          const Icon = STAGE_ICONS[stage];
          const isLast = i === PIPELINE_STAGES_ORDER.length - 1;

          return (
            <div key={stage} className="flex animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex flex-col items-center">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300',
                  state.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/10',
                  state.status === 'running' && 'border-blue-500/30 bg-blue-500/10 glow-sm',
                  state.status === 'error' && 'border-red-500/30 bg-red-500/10',
                  state.status === 'pending' && 'border-white/[0.06] bg-white/[0.02]',
                )}>
                  {state.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    : state.status === 'running' ? <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    : state.status === 'error' ? <AlertCircle className="h-5 w-5 text-red-400" />
                    : <Icon className="h-5 w-5 text-white/15" />}
                </div>
                {!isLast && (
                  <div className={cn(
                    'w-px flex-1 min-h-[20px] transition-all duration-500',
                    state.status === 'completed' ? 'bg-emerald-500/20' : 'bg-white/[0.04]',
                  )} />
                )}
              </div>
              <div className="ml-4 flex-1 pb-5">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-sm font-medium',
                    state.status === 'completed' && 'text-emerald-400',
                    state.status === 'running' && 'text-white',
                    state.status === 'error' && 'text-red-400',
                    state.status === 'pending' && 'text-white/25',
                  )}>
                    {STAGE_LABELS[stage]}
                  </span>
                  {state.status === 'running' && (
                    <span className="text-xs text-blue-400 font-mono">{state.progress}%</span>
                  )}
                </div>
                {state.status === 'running' && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${state.progress}%` }} />
                    </div>
                    {state.message && <p className="text-[11px] text-white/25 mt-1.5">{state.message}</p>}
                  </div>
                )}
                {state.status === 'error' && state.message && (
                  <p className="text-xs text-red-400/60 mt-1">{state.message}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ EDITOR ═══════════════════════ */

function EditorView({ project, onBack }: { project: Project; onBack: () => void }) {
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (project.instruction) {
      const inst = typeof project.instruction === 'string'
        ? JSON.parse(project.instruction as string)
        : project.instruction;
      setInstruction(inst);
    }
  }, [project]);

  const selectedStep = instruction?.steps[selectedIdx] ?? null;

  const updateStep = useCallback((field: string, value: string) => {
    if (!instruction) return;
    setInstruction((prev) => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      steps[selectedIdx] = { ...steps[selectedIdx], [field]: value, isManuallyEdited: true };
      return { ...prev, steps };
    });
  }, [instruction, selectedIdx]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          message: msg,
          instruction: instruction,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.content || data.message || 'Нет ответа' }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Ошибка соединения с ИИ' }]);
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, project.id, instruction]);

  const handleExport = useCallback(async (format: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, instruction }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instruction.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  }, [project.id, instruction]);

  if (!instruction) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400/40" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{instruction.title}</h1>
            <p className="text-xs text-white/30">{instruction.totalSteps} шагов · ~{instruction.estimatedReadTime} мин чтения</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChat(!showChat)}
            className={cn('flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-medium transition-all',
              showChat ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'glass glass-hover text-white/50')}>
            <MessageSquare className="h-3.5 w-3.5" /> Чат
          </button>
          <button onClick={() => setShowExport(!showExport)}
            className={cn('flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-medium transition-all',
              showExport ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'glass glass-hover text-white/50')}>
            <Download className="h-3.5 w-3.5" /> Экспорт
          </button>
        </div>
      </div>

      {/* Export Panel */}
      {showExport && (
        <div className="glass rounded-2xl p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-semibold mb-4">Экспорт инструкции</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { fmt: 'md', label: 'Markdown', icon: FileText },
              { fmt: 'html', label: 'HTML', icon: FileOutput },
            ].map(({ fmt, label, icon: Icon }) => (
              <button key={fmt} onClick={() => handleExport(fmt)}
                className="flex items-center gap-2 rounded-xl glass glass-hover px-5 py-2.5 text-sm text-white/60 hover:text-white transition-all">
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn('grid gap-4', showChat ? 'lg:grid-cols-[1fr_340px]' : '')}>
        {/* Main Editor */}
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* Steps List */}
          <div className="glass rounded-2xl p-3 lg:max-h-[calc(100vh-200px)] lg:overflow-auto">
            <div className="flex items-center justify-between px-2 py-1.5 mb-2">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Шаги</span>
              <span className="text-[10px] text-white/20">{instruction.steps.length}</span>
            </div>
            <div className="space-y-1">
              {instruction.steps.map((step, i) => (
                <button key={step.id} onClick={() => setSelectedIdx(i)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all text-sm',
                    selectedIdx === i
                      ? 'bg-blue-500/10 border border-blue-500/20 text-white'
                      : 'text-white/40 hover:bg-white/[0.03] hover:text-white/60',
                  )}>
                  <span className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
                    selectedIdx === i ? 'bg-blue-500 text-white' : 'bg-white/[0.04] text-white/30',
                  )}>
                    {i + 1}
                  </span>
                  <span className="truncate text-xs">{step.title.replace(/^Шаг \d+:\s*/, '')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step Detail */}
          {selectedStep && (
            <div className="glass rounded-2xl p-6 lg:max-h-[calc(100vh-200px)] lg:overflow-auto animate-fade-in">
              <div className="mb-4">
                <span className="text-xs text-blue-400 font-medium">Шаг {selectedIdx + 1} из {instruction.steps.length}</span>
                {selectedStep.timestampFormatted && (
                  <span className="text-xs text-white/20 ml-3">
                    <Clock className="inline h-3 w-3 mr-0.5" />{selectedStep.timestampFormatted}
                  </span>
                )}
              </div>

              {/* Screenshot */}
              {selectedStep.screenshot?.path && (
                <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-5 bg-black/20">
                  <img src={`/api/frame?path=${encodeURIComponent(selectedStep.screenshot.path)}`}
                    alt={selectedStep.title}
                    className="w-full object-contain max-h-[300px]"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-white/30 mb-1 block uppercase tracking-wider">Заголовок</label>
                  <input value={selectedStep.title} onChange={(e) => updateStep('title', e.target.value)}
                    className="w-full rounded-xl glass px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500/30 transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/30 mb-1 block uppercase tracking-wider">Описание</label>
                  <textarea value={selectedStep.description} onChange={(e) => updateStep('description', e.target.value)}
                    rows={4}
                    className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 transition-all resize-none leading-relaxed" />
                </div>
                {selectedStep.tips && selectedStep.tips.length > 0 && (
                  <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
                    <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3 w-3" /> Советы
                    </span>
                    {selectedStep.tips.map((t, i) => (
                      <p key={i} className="text-xs text-white/50 leading-relaxed">{t}</p>
                    ))}
                  </div>
                )}
                {selectedStep.warnings && selectedStep.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
                    <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <AlertCircle className="h-3 w-3" /> Предупреждения
                    </span>
                    {selectedStep.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-white/50 leading-relaxed">{w}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">
                <button onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                  disabled={selectedIdx === 0}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="h-3.5 w-3.5" /> Предыдущий
                </button>
                <button onClick={() => setSelectedIdx(Math.min(instruction.steps.length - 1, selectedIdx + 1))}
                  disabled={selectedIdx === instruction.steps.length - 1}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                  Следующий <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="glass rounded-2xl flex flex-col lg:max-h-[calc(100vh-200px)] animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold">Чат с KIMI</span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 min-h-[300px]">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Sparkles className="h-8 w-8 text-white/10" />
                  <p className="text-xs text-white/20">Задайте вопрос агенту KIMI<br/>для уточнения инструкции</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'bg-blue-500/10 border border-blue-500/20 text-white/80'
                      : 'bg-white/[0.03] border border-white/[0.04] text-white/60',
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-white/[0.04]">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Напишите сообщение..."
                  className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.04] px-4 py-2 text-xs outline-none focus:border-blue-500/20 transition-all placeholder:text-white/15"
                />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-400 transition-all">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ SETTINGS ═══════════════════════ */

function SettingsView({ onBack }: { onBack: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [model, setModel] = useState('moonshotai/kimi-k2');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [framesPerBatch, setFramesPerBatch] = useState(5);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => {
      if (data.openrouterApiKey) setApiKey(data.openrouterApiKey);
      if (data.openrouterBaseUrl) setBaseUrl(data.openrouterBaseUrl);
      if (data.agent?.kimiModel) setModel(data.agent.kimiModel);
      if (data.agent?.temperature !== undefined) setTemperature(data.agent.temperature);
      if (data.agent?.maxTokens) setMaxTokens(data.agent.maxTokens);
      if (data.agent?.framesPerBatch) setFramesPerBatch(data.agent.framesPerBatch);
    }).catch(() => {});
  }, []);

  const testKey = useCallback(async () => {
    setTestStatus('loading');
    try {
      const res = await fetch('/api/openrouter/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      setTestStatus(res.ok ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    }
  }, [apiKey]);

  const save = useCallback(async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openrouterApiKey: apiKey,
        openrouterBaseUrl: baseUrl,
        agent: { kimiModel: model, temperature, maxTokens, framesPerBatch },
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKey, baseUrl, model, temperature, maxTokens, framesPerBatch]);

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Назад
      </button>

      <h1 className="text-2xl font-bold tracking-tight mb-8">Настройки</h1>

      {/* API Section */}
      <section className="glass rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold mb-5 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
          </div>
          API
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-white/30 mb-1.5 block uppercase tracking-wider">OpenRouter API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-or-..."
                  className="w-full rounded-xl glass px-4 py-2.5 pr-10 text-sm font-mono outline-none focus:border-blue-500/30 transition-all placeholder:text-white/15" />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={testKey} disabled={!apiKey}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-xs font-medium transition-all whitespace-nowrap',
                  testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : testStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'glass glass-hover text-white/50',
                )}>
                {testStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" />
                  : testStatus === 'success' ? 'OK'
                  : testStatus === 'error' ? 'Ошибка'
                  : 'Тест'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-white/30 mb-1.5 block uppercase tracking-wider">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 transition-all" />
          </div>
        </div>
      </section>

      {/* Agent Section */}
      <section className="glass rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold mb-5 flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-violet-400" />
          </div>
          Агент KIMI
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-white/30 mb-1.5 block uppercase tracking-wider">Модель</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none bg-transparent">
              <option value="moonshotai/kimi-k2" className="bg-[#0c1220]">KIMI K2 (основная)</option>
              <option value="moonshotai/kimi-k2-thinking" className="bg-[#0c1220]">KIMI K2 Thinking (сложные случаи)</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-white/30 uppercase tracking-wider">Temperature</label>
              <span className="text-xs text-white/40 font-mono">{temperature}</span>
            </div>
            <input type="range" min="0" max="2" step="0.1" value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06] accent-blue-500 cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-white/30 mb-1.5 block uppercase tracking-wider">Max Tokens</label>
              <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 8192)}
                className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 transition-all" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-white/30 mb-1.5 block uppercase tracking-wider">Кадров в батче</label>
              <input type="number" value={framesPerBatch} onChange={(e) => setFramesPerBatch(parseInt(e.target.value) || 5)}
                min={1} max={20}
                className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none focus:border-blue-500/30 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <button onClick={save}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all active:scale-[0.98]',
          saved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400',
        )}>
        {saved ? <><CheckCircle2 className="h-4 w-4" /> Сохранено</> : 'Сохранить настройки'}
      </button>
    </div>
  );
}
