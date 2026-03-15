# dep-analyzer

Анализатор зависимостей, отладки и прав для XML-выгрузок конфигурации 1С.

## Возможности

- Построение графа зависимостей метаданных (`deps`) с рекурсивным обходом по `Depth`.
- Поиск реальных точек остановки в BSL-коде (`debug`) по процедурам/модулям/подпискам.
- Аудит прав ролей (`rights`), включая ограничения доступа (RLS), когда они присутствуют.
- Комбинированный отчёт (`full`).
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

## Требования

- Python 3.9+
- `lxml`

## Запуск (Python)

```bash
python ".claude/skills/dep-analyzer/scripts/dep-analyzer.py" \
  --config-path "/path/to/1c/xml-dump" \
  --mode deps \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3 \
  --out-format md
```

## Запуск (PowerShell wrapper)

```powershell
pwsh ".claude/skills/dep-analyzer/scripts/dep-analyzer.ps1" `
  -ConfigPath "/path/to/1c/xml-dump" `
  -Mode "full" `
  -OutFormat "json" `
  -OutFile "./report.json"
```

## Параметры CLI

- `--config-path` / `-ConfigPath` (обязательный)
- `--mode` / `-Mode`: `deps | debug | rights | full`
- `--target` / `-Target`: объект (например `Document.Sales`) или роль/объект для `rights`
- `--depth` / `-Depth`: глубина обхода (для `deps`)
- `--out-format` / `-OutFormat`: `text | json | md`
- `--limit` / `-Limit`: размер страницы
- `--offset` / `-Offset`: смещение
- `--out-file` / `-OutFile`: путь файла вывода
- `--direction`: `outgoing | incoming | both` (для `deps`)
