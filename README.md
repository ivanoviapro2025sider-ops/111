# KIMI Swarm Chat Service

Веб-сервис на Next.js для работы с Kimi K2 через OpenRouter API, с локальной SQLite/Prisma, CRUD агентов, потоковым чатом, историей сессий и chunked-загрузкой файлов до 10 ГБ.

## Возможности

- Next.js App Router + TypeScript + Tailwind UI
- OpenRouter API client для Kimi K2 / Kimi K2 Thinking и любого каталожного model id
- SQLite + Prisma для агентов, функций, настроек, истории чатов и файлов
- Swarm orchestration с triage/handoff между агентами
- SSE-streaming ответов в чате
- Chunked file uploads (5 MB chunks) с серверной сборкой и автообработкой
- File processing pipeline для PDF, DOCX, XLSX, CSV, YAML, HTML, изображений и text/code форматов
- CRUD-страницы: Chat, Agents, Files, Settings

## Быстрый старт

```bash
cp .env.example .env.local
npm install
npm run prisma:push
npm run dev
```

Откройте: http://localhost:3000

## Важные маршруты

- `/chat` — интерфейс чата
- `/agents` — список агентов
- `/agents/[id]` — полная форма настроек агента
- `/files` — загрузка и просмотр файлов
- `/settings` — глобальные настройки OpenRouter и интерфейса

## API

- `GET/POST /api/chat`
- `GET/POST /api/agents`
- `GET/PUT/DELETE /api/agents/:id`
- `POST /api/files/upload`
- `GET/DELETE /api/files/:id`
- `GET/POST /api/files/process`
- `GET/PUT /api/settings`
- `GET /api/openrouter/models`

## Примечания

- Если `OPENROUTER_API_KEY` не задан, чат работает в локальном demo-режиме с потоковым fallback-ответом.
- Для реально больших бинарных форматов каркас подготовлен, а конкретные экстракторы удобно расширять в `lib/file-processor.ts`.
