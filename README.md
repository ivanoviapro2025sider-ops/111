# KIMI Swarm Chat

Multi-agent chat service powered by **KIMI K2** (Moonshot AI) via **OpenRouter API**, with Swarm architecture for agent orchestration.

## Features

- **Multi-Agent Swarm Architecture** — Create and configure multiple AI agents with handoff capabilities
- **Streaming Responses** — Real-time SSE-based streaming chat responses
- **File Processing** — Upload and process documents (PDF, DOCX, XLSX, CSV, images, code, etc.) up to 10 GB
- **Chunked Upload** — Resumable chunked file uploads for large files
- **Full Agent Configuration** — Temperature, top_p, top_k, frequency/presence/repetition penalties, max tokens, stop sequences, and more
- **Swarm Orchestration** — Agent handoffs, tool calling, context variables, debug mode
- **Dark/Light Theme** — Modern, minimalistic UI with theme switching
- **Chat History** — SQLite-backed persistent chat history
- **Markdown Rendering** — Full markdown support with syntax highlighting in code blocks

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend:** Next.js API Routes, Node.js
- **Database:** SQLite via Prisma ORM
- **State Management:** Zustand
- **API:** OpenRouter REST API (OpenAI-compatible format)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Configuration

Create a `.env.local` file (or edit the existing one):

```env
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=moonshotai/kimi-k2
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE=10737418240
UPLOAD_DIR=./uploads
DATABASE_URL="file:./dev.db"
```

### Database Setup

```bash
npx prisma db push
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── api/           # API routes (chat, agents, files, settings, openrouter)
│   ├── chat/          # Chat page
│   ├── agents/        # Agent management pages
│   ├── files/         # File manager page
│   ├── settings/      # Settings page
│   └── layout.tsx     # Root layout
├── components/
│   ├── chat/          # Chat UI components
│   ├── agents/        # Agent management components
│   ├── files/         # File upload/list components
│   ├── settings/      # Settings components
│   ├── ui/            # Shared UI primitives (shadcn-style)
│   └── layout/        # Layout components (sidebar, header)
├── lib/
│   ├── openrouter.ts  # OpenRouter API client
│   ├── swarm.ts       # Swarm orchestration logic
│   ├── file-processor.ts  # File processing pipeline
│   ├── chunked-upload.ts  # Chunked upload utilities
│   ├── db.ts          # Prisma client
│   └── utils.ts       # Utility functions
├── stores/            # Zustand state stores
├── types/             # TypeScript type definitions
├── prisma/            # Prisma schema
└── uploads/           # Uploaded files (gitignored)
```

## Supported Models

- `moonshotai/kimi-k2` — Main KIMI K2 model (1T parameters, MoE, 32B active)
- `moonshotai/kimi-k2-thinking` — KIMI K2 with step-by-step reasoning
- Any model from the OpenRouter catalog
