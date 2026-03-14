# KIMI Swarm Chat Service

Веб-сервис чат-бота с мультиагентной архитектурой (Swarm), OpenRouter API и загрузкой больших файлов.

## Стек

- Next.js (App Router), React, TypeScript, Tailwind
- API Route Handlers (Node runtime)
- SQLite + Prisma
- Zustand для состояния клиента
- OpenRouter (OpenAI-совместимый API)
- Chunked upload (5 MB чанки)

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env.local` на основе шаблона:

```bash
cp .env.local.example .env.local
```

3. Сгенерируйте Prisma client и примените схему:

```bash
npm run prisma:generate
npm run prisma:push
```

4. Запустите приложение:

```bash
npm run dev
```

Приложение будет доступно на [http://localhost:3000](http://localhost:3000).

## Основные страницы

- `/chat` — чат с потоковым ответом, debug и handoff-событиями
- `/agents` — список и CRUD агентов
- `/agents/[id]` — полная форма настроек агента (sampling/swarm/functions)
- `/files` — загрузка, список, обработка и превью файлов
- `/settings` — глобальные настройки сервиса

## Основные API маршруты

- `POST /api/chat`
- `GET|POST /api/agents`
- `GET|PUT|DELETE /api/agents/:id`
- `POST /api/files/upload`
- `GET|DELETE /api/files/:id`
- `POST /api/files/process`
- `GET|PUT /api/settings`
- `GET /api/openrouter/models`

## Примечание

По умолчанию папка загрузок — `./uploads`, лимит — 10 GB на файл.
