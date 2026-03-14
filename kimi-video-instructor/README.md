# KIMI Video Instructor

Service for generating step-by-step instructions from video through KIMI agent (OpenRouter API).

Upload a video (screencast, tutorial, process recording - up to 10 GB), and the service will automatically:
1. Extract audio and transcribe speech to text
2. Split video into key frames (screenshots) by scene changes
3. Send screenshots + transcription to KIMI K2 agent (via OpenRouter API)
4. Agent analyzes, matches screenshots with text, and generates a step-by-step instruction with illustrations
5. Get a ready document (Markdown / HTML) — each step contains a screenshot + text description

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Node.js 20+
- **Video:** ffmpeg (audio extraction, frame extraction)
- **Transcription:** OpenAI Whisper API via OpenRouter
- **Vision/LLM:** KIMI K2 via OpenRouter API (multimodal model)
- **Database:** SQLite (Prisma ORM)
- **State:** Zustand

## Prerequisites

- Node.js 20+
- ffmpeg installed (`sudo apt install ffmpeg`)
- OpenRouter API key

## Quick Start

```bash
cd kimi-video-instructor
npm install
npm run setup    # checks ffmpeg, creates dirs, initializes DB
npm run dev      # starts at http://localhost:3000
```

## Configuration

Edit `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=moonshotai/kimi-k2
WHISPER_PROVIDER=openrouter
DATABASE_URL="file:./prisma/dev.db"
```

## Project Structure

```
kimi-video-instructor/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # REST API endpoints
│   ├── projects/          # Project pages (list, new, workspace, editor, export)
│   ├── chat/              # Chat with KIMI agent
│   └── settings/          # Global settings
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── layout/           # Sidebar, Header, ThemeProvider
│   ├── project/          # ProjectCard, VideoUploader, UploadProgress
│   ├── pipeline/         # PipelineStatus, FrameGallery, TranscriptViewer
│   ├── editor/           # InstructionEditor, StepCard, StepText
│   ├── chat/             # ChatWindow, MessageBubble, ChatInput
│   └── settings/         # APIKeyInput, ModelSelector, AgentSettings
├── lib/                   # Server-side modules
│   ├── openrouter.ts     # OpenRouter API client
│   ├── pipeline.ts       # Pipeline orchestrator
│   ├── video-processor.ts # ffmpeg operations
│   ├── transcriber.ts    # Whisper transcription
│   ├── kimi-agent.ts     # KIMI agent logic
│   └── exporter.ts       # Export to MD/HTML
├── stores/               # Zustand state stores
├── types/                # TypeScript type definitions
├── prisma/               # Database schema
└── workspace/            # Working directory (gitignored)
```

## Pipeline Stages

1. **Upload** — Chunked upload (5MB chunks) for large video files
2. **Extract Audio** — ffmpeg extracts audio track to WAV
3. **Transcribe** — Whisper API transcribes speech to text with timestamps
4. **Extract Frames** — Key frames extracted (scene detection / fixed interval / combined)
5. **Align** — Match frames with transcript segments by timestamps
6. **Analyze** — KIMI K2 analyzes frame batches with transcript context
7. **Generate** — Build structured step-by-step instruction from analysis

## Supported Models

| Model | ID | Purpose |
|-------|----|---------|
| KIMI K2 | `moonshotai/kimi-k2` | Main: frame analysis + instruction text generation |
| KIMI K2 Thinking | `moonshotai/kimi-k2-thinking` | Complex cases: step-by-step reasoning |
