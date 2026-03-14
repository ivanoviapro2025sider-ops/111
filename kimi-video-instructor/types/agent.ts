export interface AgentSettings {
  kimiModel: string;
  thinkingModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  framesPerBatch: number;
  batchDelay: number;
  maxContextTokens: number;
  retryAttempts: number;
  retryDelay: number;
  analysisPrompt: string;
  generationPrompt: string;
}

export const DEFAULT_ANALYSIS_PROMPT = `Ты — профессиональный технический писатель (техрайтер), специализирующийся на создании пошаговых инструкций из видеозаписей экрана.

Тебе предоставлены кадры (скриншоты) из обучающего видео и транскрипция речи, соответствующая этим кадрам.

ЗАДАЧА: Для каждого кадра определи:
1. **Описание кадра** — Что видно на экране (интерфейс, окна, элементы UI)
2. **Действие пользователя** — Что делает или собирается сделать пользователь
3. **Элементы UI** — Конкретные кнопки, поля, меню, которые задействованы
4. **Важность** — Является ли это значимым шагом инструкции (true/false)
5. **Заголовок шага** — Если шаг важен, предложи краткий заголовок
6. **Аннотации** — Где на скриншоте нужно поставить стрелку или рамку

Отвечай строго в формате JSON:
{
  "frames": [
    {
      "frameId": "...",
      "description": "...",
      "userAction": "...",
      "uiElements": ["кнопка Save", "поле Name"],
      "isImportantStep": true,
      "suggestedStepTitle": "Сохраните настройки",
      "suggestedAnnotations": [
        {"type": "rectangle", "x": 75, "y": 85, "width": 15, "height": 5, "label": "Нажмите Save", "color": "#ef4444"}
      ]
    }
  ]
}

КОНТЕКСТ: Транскрипция для этих кадров:
{transcript_text}`;

export const DEFAULT_GENERATION_PROMPT = `Ты — профессиональный технический писатель. На основании анализа видеозаписи создай чёткую, пошаговую инструкцию.

ДАННЫЕ: Тебе предоставлен JSON с анализом каждого кадра видео.

ТРЕБОВАНИЯ К ИНСТРУКЦИИ:
1. Объедини последовательные кадры с одним действием в ОДИН шаг
2. Каждый шаг должен содержать:
   - Краткий заголовок (императив: "Откройте...", "Нажмите...", "Введите...")
   - Подробное описание (1-3 предложения)
   - К какому скриншоту привязан (frameId)
   - Полезные советы (tips), если есть нюансы
   - Предупреждения (warnings), если можно что-то сломать
3. Пиши на языке: {language}
4. Стиль: {style}
5. Не пропускай важные шаги
6. Нумерация должна быть сквозной

Ответ в формате JSON:
{
  "title": "Название инструкции",
  "description": "Краткое описание",
  "steps": [
    {
      "order": 1,
      "title": "Шаг 1: ...",
      "description": "...",
      "frameId": "...",
      "tips": ["..."],
      "warnings": ["..."]
    }
  ]
}`;

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  kimiModel: 'moonshotai/kimi-k2',
  thinkingModel: 'moonshotai/kimi-k2-thinking',
  temperature: 0.3,
  topP: 0.9,
  maxTokens: 8192,
  frequencyPenalty: 0,
  presencePenalty: 0,
  framesPerBatch: 5,
  batchDelay: 1000,
  maxContextTokens: 65536,
  retryAttempts: 3,
  retryDelay: 2000,
  analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
  generationPrompt: DEFAULT_GENERATION_PROMPT,
};

export interface GlobalSettings {
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  whisperProvider: 'openrouter' | 'openai' | 'local';
  openaiApiKey: string;
  agent: AgentSettings;
  video: {
    maxFileSize: number;
    frameExtractionMethod: string;
    fixedIntervalSeconds: number;
    sceneChangeThreshold: number;
    maxFrames: number;
    frameQuality: number;
    frameResolution: string;
    whisperModel: string;
    whisperLanguage: string;
  };
  instruction: {
    defaultLanguage: string;
    defaultStyle: string;
    includeTimestamps: boolean;
    includeTips: boolean;
    includeWarnings: boolean;
    annotateScreenshots: boolean;
  };
  ui: {
    theme: 'dark' | 'light' | 'system';
    language: string;
  };
}
