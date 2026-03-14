# KIMI Swarm Studio

Веб-сервис для управления swarm-агентами KIMI через [OpenRouter](https://openrouter.ai/), с UI для настройки всех основных параметров и потоковой загрузкой файлов до **10 GB**.

## Что умеет

- настройка OpenRouter API: `apiKey`, `baseUrl`, `siteUrl`, `siteName`, модель по умолчанию, `temperature`, `top_p`, `max_tokens`
- настройка swarm-оркестрации: planner model, synthesis model, режим `sequential | parallel | hybrid`, лимиты на количество worker-агентов и на обработку файлов
- полное редактирование worker-агентов:
  - id, name, goal
  - model
  - temperature / top_p / max_tokens
  - system prompt
  - enabled / use file context
  - tool flags
- загрузка файлов чанками по **8 MB** с финальной сборкой на сервере
- обработка файлов агентом:
  - text / markdown / json / csv / code-файлы — семплирование больших файлов
  - pdf / docx / xlsx — извлечение текста или превью, если размер входит в лимит
  - images — inline data URL для multimodal reasoning
  - audio / video / binary — сохранение и передача метаданных в swarm

## Стек

- Next.js 16
- React 19
- TypeScript
- OpenRouter Chat Completions API
- Локальное JSON-хранилище для настроек и индекса загрузок

## Запуск

```bash
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:3000`.

## Переменные окружения

Необязательно, но можно задать стартовые значения:

```bash
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME="KIMI Swarm Studio"
```

## Как использовать

1. Откройте панель **OpenRouter settings** и вставьте OpenRouter API key.
2. Настройте planner / synthesis / worker-агентов.
3. Загрузите один или несколько файлов через блок **Large file ingestion**.
4. Отметьте нужные файлы чекбоксами.
5. Введите задачу в блоке **Swarm chat** и нажмите **Run swarm**.

## Хранение данных

- `data/settings.json` — сохраненные настройки
- `data/uploads/index.json` — индекс файлов
- `data/uploads/files/*` — собранные загруженные файлы
- `data/uploads/tmp/*` — временные чанки во время загрузки

Папка `data/` исключена из git, чтобы не коммитить API-ключи и пользовательские файлы.

## Ограничения MVP

- файлы до 10 GB можно загружать и хранить, но для очень больших файлов в prompt отправляется семпл или метаданные, а не весь бинарный контент
- для бинарных, аудио и видеофайлов по умолчанию выполняется reasoning по метаданным, если не добавлена отдельная медиа-пайплайн обработка
- swarm выполняется через planner -> workers -> synthesis, что удобно для кастомизации, но не заменяет полноценный job queue / background worker
