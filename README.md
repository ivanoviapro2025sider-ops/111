# KIMI Swarm Chat

Multi-agent chat service powered by **Kimi K2** (Moonshot AI) via **OpenRouter API**, with Swarm-based orchestration, file processing, and a modern web interface.

## Features

- **Multi-Agent Swarm Architecture** - Configure multiple AI agents with automatic handoff between them
- **OpenRouter API Integration** - Connect to Kimi K2 and any model available on OpenRouter
- **Streaming Responses** - Real-time streaming via Server-Sent Events
- **File Upload & Processing** - Support for 50+ file types, chunked upload up to 10 GB
- **Agent Configuration** - Full control over sampling parameters, system prompts, tools/functions, and handoff logic
- **Dark Theme UI** - Modern, responsive interface built with shadcn/ui

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Node.js
- **Database:** SQLite via Prisma ORM
- **State Management:** Zustand
- **API Client:** OpenAI SDK (OpenRouter-compatible)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local` and set your OpenRouter API key:

```env
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=moonshotai/kimi-k2
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE=10737418240
UPLOAD_DIR=./uploads
DATABASE_URL=file:./dev.db
```

### 3. Initialize database

```bash
npx prisma db push
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/
│   ├── api/          # API routes (chat, agents, files, settings, models)
│   ├── chat/         # Chat page
│   ├── agents/       # Agent management pages
│   ├── files/        # File manager page
│   ├── settings/     # Global settings page
│   └── layout.tsx    # Root layout
├── components/
│   ├── chat/         # Chat UI components
│   ├── agents/       # Agent UI components
│   ├── files/        # File upload/list components
│   ├── settings/     # Settings components
│   ├── ui/           # shadcn/ui base components
│   └── layout/       # Layout components (Sidebar, Header)
├── lib/
│   ├── openrouter.ts # OpenRouter API client
│   ├── swarm.ts      # Swarm orchestration logic
│   ├── file-processor.ts
│   ├── chunked-upload.ts
│   ├── db.ts         # Prisma client
│   └── utils.ts
├── stores/           # Zustand stores
├── types/            # TypeScript type definitions
├── prisma/           # Database schema
└── uploads/          # Uploaded files (gitignored)
```

## Pages

| Route | Description |
|-------|-------------|
| `/chat` | Main chat interface with streaming, agent selection, file attachments |
| `/agents` | Agent management - create, edit, delete agents with full parameter control |
| `/agents/[id]` | Detailed agent settings (General, Sampling, Swarm, Functions tabs) |
| `/files` | File upload with drag-and-drop, chunked upload, processing |
| `/settings` | Global settings: API key, model selection, defaults, theme |

## Supported Models

- `moonshotai/kimi-k2` - Main Kimi K2 model (default)
- `moonshotai/kimi-k2-thinking` - Kimi K2 with step-by-step reasoning
- Any model available on OpenRouter

## License

MIT
