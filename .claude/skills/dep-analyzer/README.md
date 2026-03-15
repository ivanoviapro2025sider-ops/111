# dep-analyzer

`dep-analyzer` — skill для анализа выгрузок конфигурации 1С. Он строит граф зависимостей метаданных, ищет реальные точки остановки в BSL-коде, а также собирает аудит прав и RLS по ролям.

## Структура

```text
.claude/skills/dep-analyzer/
├── SKILL.md
├── README.md
└── scripts/
    ├── dep-analyzer.ps1
    ├── dep-analyzer.py
    ├── scanner.py
    ├── parser_catalog.py
    ├── parser_document.py
    ├── parser_register.py
    ├── parser_misc.py
    ├── parser_role.py
    ├── bsl_analyzer.py
    ├── graph_builder.py
    ├── output_deps.py
    ├── output_debug.py
    ├── output_rights.py
    ├── output_full.py
    ├── models.py
    └── xml_helpers.py
```

## Возможности

### 1. Граф зависимостей (`deps`)

Строятся связи:

- документы -> регистры;
- документы -> справочники/документы;
- справочники -> справочники/документы;
- регистры -> документы/справочники/регистры;
- подписки -> источники событий;
- подписки -> общие модули-обработчики;
- вызовы BSL -> общие модули;
- обращения из BSL -> объекты метаданных;
- ссылки в текстах запросов -> объекты метаданных;
- связи `owner`, `hierarchy`, `based_on`.

Поддерживается рекурсивный обход графа по `Depth`.

### 2. Отладка (`debug`)

Ищутся:

- процедуры и функции с реальными номерами строк;
- обработчики проведения/записи/удаления объектов;
- обработчики подписок на события;
- целевые процедуры общих модулей, вызываемые из BSL.

### 3. Права (`rights`)

Собираются:

- права ролей по объектам;
- права по реквизитам/полям;
- признаки RLS;
- текст условий RLS;
- шаблоны ограничений доступа.

### 4. Полный режим (`full`)

Объединяет `deps`, `debug` и `rights`.

## Использование

### PowerShell wrapper

Wrapper:

- ищет Python в порядке `python3 -> python -> py -3`;
- автоматически проверяет наличие `lxml`;
- при необходимости вызывает `pip install lxml`;
- прокидывает все параметры в `dep-analyzer.py`.

Пример:

```powershell
./scripts/dep-analyzer.ps1 `
  -ConfigPath "C:\dump\MyConfig" `
  -Mode deps `
  -Target "Catalog.Номенклатура" `
  -Depth 3 `
  -OutFormat text
```

### Python CLI

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  --config-path /path/to/dump \
  --mode full \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 4 \
  --out-format md \
  --out-file /tmp/dep-analysis.md
```

## Параметры CLI

| Parameter | Description |
| --- | --- |
| `--config-path` | Путь к каталогу выгрузки |
| `--mode` | `deps`, `debug`, `rights`, `full` |
| `--target` | Имя объекта или полный ключ, например `Catalog.Номенклатура` |
| `--depth` | Глубина рекурсивного обхода |
| `--out-format` | `text`, `json`, `md` |
| `--limit` | Максимум элементов в ответе |
| `--offset` | Смещение для пагинации |
| `--out-file` | Файл для сохранения результата |

## Примеры режимов

### Dependencies

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  --config-path /path/to/dump \
  --mode deps \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3 \
  --out-format json
```

### Debug points

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  --config-path /path/to/dump \
  --mode debug \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3 \
  --out-format text
```

### Rights and RLS

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  --config-path /path/to/dump \
  --mode rights \
  --target "Catalog.Номенклатура" \
  --out-format md
```

## Ограничения и допущения

- Skill ориентирован на файловые XML-выгрузки конфигурации 1С.
- Реальная структура выгрузок может отличаться между версиями платформы, поэтому парсеры намеренно используют мягкий XPath по `local-name()` и fallback-эвристику.
- Анализ BSL является статическим и не исполняет код.
- Если структура роли или RLS сильно кастомна, parser сохраняет максимально возможный набор данных, даже если часть прав распознана эвристически.

## Внутренняя схема работы

1. `scanner.py` индексирует объекты конфигурации.
2. `parser_*` обогащают объекты реквизитами, ссылками и правами.
3. `bsl_analyzer.py` анализирует модули и запросы.
4. `graph_builder.py` собирает итоговый граф и debug points.
5. `output_*` форматируют результат.
