# KIMI Swarm Chat Service

Мультиагентный чат-сервис на Next.js (App Router) с OpenRouter API, SQLite/Prisma, потоковым SSE-чатом и загрузкой больших файлов (chunked upload до 10 GB).

## Технологии

- Next.js 16 (App Router), React, TypeScript
- Tailwind CSS + кастомные UI-компоненты (shadcn-style)
- Prisma + SQLite
- Zustand
- OpenRouter API (OpenAI-compatible)
- Chunked file upload + file processing pipeline

## Быстрый старт

1) Установить зависимости:

```bash
npm install
```

2) Создать env:

```bash
cp .env.example .env.local
```

3) Инициализировать Prisma:

```bash
npx prisma generate
npx prisma db push
```

4) Запустить dev-сервер:

```bash
npm run dev
```

Откройте: http://localhost:3000

## Основные маршруты

- `/chat` — чат с SSE-стримингом и handoff-индикацией
- `/agents` — управление агентами
- `/agents/[id]` — расширенная форма настройки агента
- `/files` — загрузка/обработка файлов
- `/settings` — глобальные настройки

## API

- `POST /api/chat`
- `GET|POST /api/agents`
- `GET|PATCH|DELETE /api/agents/:id`
- `POST /api/files/upload`
- `GET|DELETE /api/files/:id`
- `POST /api/files/process`
- `GET|PUT /api/settings`
- `GET /api/openrouter/models`
