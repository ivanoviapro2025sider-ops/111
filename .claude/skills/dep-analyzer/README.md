# dep-analyzer

Анализатор зависимостей, отладки и прав для XML-выгрузки конфигурации 1С.

## Возможности

- Построение графа зависимостей метаданных:
  - структурные ссылки (реквизиты/измерения/ресурсы),
  - движения документов в регистры,
  - связи `BasedOn`,
  - подписки на события,
  - BSL-вызовы общих модулей и ссылки на метаданные.
- Поиск реальных точек остановки:
  - процедуры/функции из `.bsl` с номером строки и путём к модулю.
- Аудит прав:
  - права ролей на объекты,
  - RLS-флаги и условия,
  - RLS-шаблоны.
- Вывод в форматах `text`, `json`, `md`.

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

## Быстрый запуск (Python)

```bash
python ".claude/skills/dep-analyzer/scripts/dep-analyzer.py" \
  --config-path "/path/to/1c-export" \
  --mode deps \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3 \
  --out-format text
```

## Быстрый запуск (PowerShell)

```powershell
pwsh ".claude/skills/dep-analyzer/scripts/dep-analyzer.ps1" `
  -ConfigPath "/path/to/1c-export" `
  -Mode "full" `
  -OutFormat "json" `
  -OutFile "./dep-report.json"
```

## Режимы

- `deps` — зависимости и обход графа.
- `debug` — точки остановки по BSL.
- `rights` — права ролей и RLS.
- `full` — агрегированный вывод `deps + debug + rights`.

## Примечания

- `Depth` применяется к обходу графа в режимах `deps` и `full`.
- Для `rights` фильтрация по `Target` работает по имени роли и объектам прав.
- PowerShell-обёртка автоматически проверяет `lxml` и ставит его через `pip`, если пакет отсутствует.

