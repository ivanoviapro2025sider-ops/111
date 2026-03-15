# dep-analyzer

`dep-analyzer` — skill для анализа выгрузки конфигурации 1С (XML + BSL).

## Возможности

- Построение графа зависимостей между объектами метаданных.
- Рекурсивный обход графа с ограничением глубины (`Depth`).
- Анализ BSL:
  - процедуры/функции;
  - вызовы модулей;
  - обращения к метаданным;
  - ссылки в запросах.
- Аудит прав ролей, включая RLS-условия и шаблоны.
- Форматы вывода: `text`, `json`, `md`.

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

## CLI (Python)

```bash
python ".claude/skills/dep-analyzer/scripts/dep-analyzer.py" \
  --config-path "/path/to/1c-dump" \
  --mode deps \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3 \
  --out-format text
```

### Аргументы

- `--config-path` (обязательный)
- `--mode`: `deps|debug|rights|full`
- `--target`: точечный объект (`Type.Name`) или короткое имя
- `--depth`: глубина обхода (для `deps`/`full`)
- `--direction`: `outgoing|incoming|both` (для `deps`/`full`)
- `--out-format`: `text|json|md`
- `--limit`, `--offset`: пагинация
- `--out-file`: запись отчёта в файл

## PowerShell wrapper

```powershell
pwsh ".claude/skills/dep-analyzer/scripts/dep-analyzer.ps1" `
  -ConfigPath "/path/to/1c-dump" `
  -Mode "full" `
  -Depth 3 `
  -OutFormat "md" `
  -OutFile "report.md"
```

Wrapper:

- ищет Python в порядке: `python3` -> `python` -> `py -3`;
- проверяет `lxml` и при необходимости делает `pip install lxml`;
- проксирует все параметры в `dep-analyzer.py`.
