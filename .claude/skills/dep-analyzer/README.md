# dep-analyzer

`dep-analyzer` — модульный skill для анализа XML-выгрузок конфигурации 1С.

## Возможности

- построение графа зависимостей между объектами метаданных;
- рекурсивный обход связей по `Depth`;
- поиск реальных точек остановки в BSL-модулях;
- аудит ролей, прав и RLS;
- вывод в `text`, `json`, `md`.

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

## Режимы

### `deps`

Показывает объекты и рёбра графа зависимостей:

- ссылки реквизитов;
- движения документа по регистрам;
- ввод на основании;
- владельцев и иерархию справочников;
- подписки на события;
- вызовы из BSL и ссылки на объекты в запросах.

### `debug`

Ищет реальные BSL-процедуры, пригодные для постановки breakpoint:

- обработка проведения/записи документов;
- обработчики подписок на события;
- методы регламентных заданий.

### `rights`

Парсит роли и `Rights.xml`:

- права на объекты;
- признак deny;
- RLS (`restrictionByCondition`);
- шаблоны ограничений.

### `full`

Комбинирует все три отчёта в один.

## CLI

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  -ConfigPath ./dump \
  -Mode full \
  -Target "Document.РеализацияТоваровУслуг" \
  -Depth 4 \
  -OutFormat md \
  -OutFile ./dep-report.md
```

### Аргументы

| Аргумент | По умолчанию | Назначение |
| --- | --- | --- |
| `-ConfigPath` | — | Корень XML-выгрузки или `Configuration.xml` |
| `-Mode` | `deps` | `deps`, `debug`, `rights`, `full` |
| `-Target` | `""` | Фокус на объект/роль |
| `-Depth` | `3` | Глубина обхода графа |
| `-OutFormat` | `text` | `text`, `json`, `md` |
| `-Limit` | `150` | Ограничение строк для `text`/`md` |
| `-Offset` | `0` | Смещение строк для `text`/`md` |
| `-OutFile` | `""` | Вывод в файл UTF-8 BOM |

## PowerShell wrapper

Wrapper:

- ищет `python3`, затем `python`, затем `py -3`;
- автоматически ставит `lxml`, если пакет отсутствует;
- пробрасывает все CLI-параметры в `dep-analyzer.py`;
- совместим с Windows PowerShell 5.1 и PowerShell 7+.

## Ограничения текущего статического анализа

- парсер рассчитан на стандартную XML-структуру выгрузки 1С и использует мягкие XPath/regex-эвристики;
- сложные динамические вызовы BSL, вычисляемые имена методов и косвенные обращения могут не попасть в граф;
- пагинация применяется только к `text` и `md`, JSON отдаётся целиком, чтобы не ломать валидность структуры.
