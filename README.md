# KIMI Swarm Chat

Multi-agent chat service powered by **Kimi K2** (Moonshot AI) via **OpenRouter API**, with Swarm-based orchestration, file processing up to 10 GB, and a modern dark-themed web interface.

## Quick Start (3 commands)

```bash
git clone https://github.com/ivanoviapro2025sider-ops/111.git kimi-swarm-chat
cd kimi-swarm-chat
npm run setup
```

Then edit `.env.local` and set your OpenRouter API key:

```
OPENROUTER_API_KEY=sk-or-your-real-key
```

Start the server:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## Setup Details

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+
- An **OpenRouter API key** (get one at [openrouter.ai](https://openrouter.ai))

### Manual Setup (step by step)

```bash
# 1. Install dependencies
npm install

# 2. Create environment config
cp .env.example .env.local
# Edit .env.local — set OPENROUTER_API_KEY

# 3. Initialize database
DATABASE_URL=file:./dev.db npx prisma db push

# 4. Seed demo agents (optional)
npm run db:seed

# 5. Create uploads directory
mkdir -p uploads

# 6. Start
npm run dev
```

### Environment Variables (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | **Required.** Your OpenRouter API key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter API base URL |
| `OPENROUTER_DEFAULT_MODEL` | `moonshotai/kimi-k2` | Default model |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | App URL (for HTTP-Referer header) |
| `MAX_FILE_SIZE` | `10737418240` | Max upload size in bytes (10 GB) |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded files |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full automated setup (deps, env, DB, seed) |
| `npm run dev` | Start development server on http://localhost:3000 |
| `npm run dev:next` | Start via standard `next dev` |
| `npm run prod` | Production build + start |
| `npm run build` | Build for production only |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:seed` | Seed demo agents (Triage, Analyst, Writer) |
| `npm run db:studio` | Open Prisma Studio (database browser) |

## Features

- **Multi-Agent Swarm** — configure agents with automatic handoff between them
- **OpenRouter API** — Kimi K2 and any model from the OpenRouter catalog
- **Streaming** — real-time SSE streaming responses
- **File Upload** — drag-and-drop, chunked upload up to 10 GB, 50+ file types
- **Agent Settings** — full control: sampling parameters, system prompts, tools/functions, handoffs
- **Chat History** — persisted in SQLite, export to JSON/Markdown/TXT
- **Dark UI** — modern interface with shadcn/ui components

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes + custom Node.js HTTP server
- **Database:** SQLite via Prisma ORM
- **State:** Zustand
- **API:** OpenAI SDK (OpenRouter-compatible)

## Project Structure

```
├── server.js              # Custom Node.js HTTP server
├── scripts/
│   ├── setup.sh           # Automated setup script
│   ├── start.sh           # Unified launcher (dev/prod)
│   └── seed.js            # Demo data seeder
├── app/
│   ├── api/               # API routes
│   │   ├── chat/          # Chat + export endpoints
│   │   ├── agents/        # Agent CRUD
│   │   ├── files/         # Upload, process, list
│   │   ├── settings/      # Global settings
│   │   └── openrouter/    # Model listing, connection test
│   ├── chat/              # Chat page
│   ├── agents/            # Agent management
│   ├── files/             # File manager
│   └── settings/          # Settings page
├── components/
│   ├── chat/              # ChatWindow, MessageBubble, ChatInput, ...
│   ├── agents/            # AgentCard, AgentForm, FunctionEditor, ...
│   ├── files/             # FileUploader, FileList, FilePreview, ...
│   ├── settings/          # APIKeyInput, ModelSelector, ...
│   ├── ui/                # shadcn/ui base components
│   └── layout/            # Sidebar, Header
├── lib/                   # OpenRouter client, Swarm engine, file processor
├── stores/                # Zustand stores (chat, agent, settings)
├── types/                 # TypeScript definitions
├── prisma/schema.prisma   # Database schema
└── uploads/               # Uploaded files (gitignored)
```

## Demo Agents (after `npm run db:seed`)

| Agent | Color | Role | Handoffs |
|-------|-------|------|----------|
| **Triage Agent** | Indigo | Routes requests to specialists | → Analyst, Writer |
| **Analyst** | Green | Data analysis, code review | → Triage, Writer |
| **Writer** | Amber | Content generation, creative writing | → Triage, Analyst |

## Supported Models

- `moonshotai/kimi-k2` — Kimi K2 (1T params, MoE, 32B active)
- `moonshotai/kimi-k2-thinking` — Kimi K2 with chain-of-thought
- Any model from the [OpenRouter catalog](https://openrouter.ai/models)

## License

MIT
