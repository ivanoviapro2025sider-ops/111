# KIMI Swarm Chat Service

Веб-сервис чат-бота с мультиагентной orchestration (Swarm), OpenRouter API, SQLite/Prisma и загрузкой больших файлов чанками (до 10 ГБ).

## Стек

- Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- API Routes (Route Handlers)
- SQLite + Prisma ORM
- Zustand для клиентского состояния
- OpenRouter (OpenAI-совместимый API)
- Chunked upload (5 MB chunks), серверная сборка в `/uploads`

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Подготовить окружение:

```bash
cp .env.local.example .env.local
```

3. Сгенерировать Prisma client и создать SQLite:

```bash
npm run db:generate
npm run db:push
```

4. Запустить:

```bash
npm run dev
```

Откройте: [http://localhost:3000](http://localhost:3000)

## Основные страницы

- `/chat` — чат со streaming (SSE), выбором агентов и прикреплением файлов
- `/agents` — CRUD агентов и конфигурация Swarm/sampling/functions
- `/files` — загрузка/список/обработка файлов
- `/settings` — глобальные параметры OpenRouter, модели, defaults

## API endpoints

- `POST /api/chat` — streaming-ответ агента (SSE)
- `GET /api/chat` — список чатов
- `GET /api/chat?chatId=...` — чат с сообщениями
- `GET/POST /api/agents` — список/создание агента
- `GET/PUT/DELETE /api/agents/:id` — операции с агентом
- `POST /api/files/upload` — chunked upload (или single chunk upload)
- `GET /api/files` — список файлов
- `GET/DELETE /api/files/:id` — получить/удалить файл
- `POST /api/files/process` — извлечение/обработка содержимого файла
- `GET/PUT /api/settings` — глобальные настройки
- `GET /api/openrouter/models` — модели OpenRouter

## Примечания

- При отсутствии `OPENROUTER_API_KEY` чат работает в демо-режиме с fallback ответом.
- Фактическая обработка некоторых редких форматов (часть архивов/медиа) обозначена как расширяемая зона.
