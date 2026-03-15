# dep-analyzer

Анализатор зависимостей, отладки и прав метаданных конфигураций 1С:Предприятие.

## Архитектура

```
.claude/skills/dep-analyzer/
├── SKILL.md                    # Манифест skill
├── README.md                   # Документация
└── scripts/
    ├── dep-analyzer.ps1        # PowerShell-обёртка
    ├── dep-analyzer.py         # Entry-point, CLI, оркестрация
    ├── models.py               # Модели данных: ObjectInfo, DependencyGraph, Edge и др.
    ├── xml_helpers.py          # XML-утилиты: namespace map, xpath-хелперы, типы
    ├── scanner.py              # Сканирование Configuration.xml + индекс объектов
    ├── parser_catalog.py       # Парсер справочников
    ├── parser_document.py      # Парсер документов
    ├── parser_register.py      # Парсер регистров (сведений/накопления/бухгалтерии/расчёта)
    ├── parser_misc.py          # Парсер: подписки, общие модули, перечисления и др.
    ├── parser_role.py          # Парсер ролей: Rights.xml, RLS, шаблоны
    ├── bsl_analyzer.py         # Статический анализ BSL-кода
    ├── graph_builder.py        # Построение графа зависимостей + обход по Depth
    ├── output_deps.py          # Вывод: режим deps (text/json/md)
    ├── output_debug.py         # Вывод: режим debug (text/json/md)
    ├── output_rights.py        # Вывод: режим rights (text/json/md)
    └── output_full.py          # Вывод: режим full — сборка всех выводов
```

## Требования

- Python 3.8+
- lxml (`pip install lxml`)

## Быстрый старт

### Python

```bash
cd .claude/skills/dep-analyzer
python3 scripts/dep-analyzer.py --config-path /path/to/1c/config --mode deps --target "Document.РеализацияТоваровУслуг"
```

### PowerShell

```powershell
cd .claude\skills\dep-analyzer
.\scripts\dep-analyzer.ps1 -ConfigPath "C:\path\to\1c\config" -Mode deps -Target "Document.РеализацияТоваровУслуг"
```

PowerShell-обёртка автоматически находит Python и устанавливает lxml при необходимости.

## Режимы работы

| Режим | Описание |
|-------|----------|
| `deps` | Граф зависимостей: связи между объектами метаданных |
| `debug` | Точки отладки: процедуры BSL с номерами строк и контекстом |
| `rights` | Аудит прав: роли, права на объекты, RLS-ограничения |
| `full` | Объединённый вывод всех трёх режимов |

## Форматы вывода

| Формат | Описание |
|--------|----------|
| `text` | Текстовый (по умолчанию), удобен для терминала |
| `json` | Структурированный JSON для программной обработки |
| `md` | Markdown с таблицами для документации |

## Параметры CLI

```
--config-path  Путь к каталогу конфигурации (обязательный)
--mode         Режим: deps | debug | rights | full (по умолчанию: deps)
--target       Целевой объект, например: Document.Реализация (необязательный)
--depth        Глубина обхода графа (по умолчанию: 3)
--out-format   Формат: text | json | md (по умолчанию: text)
--limit        Максимум записей (по умолчанию: 150)
--offset       Смещение для пагинации (по умолчанию: 0)
--out-file     Файл для записи результата (по умолчанию: stdout)
```

## Типы рёбер графа

| Тип ребра | Описание |
|-----------|----------|
| `doc_to_register` | Документ движет регистр |
| `doc_to_catalog` | Документ ссылается на справочник |
| `doc_to_document` | Документ ссылается на документ |
| `catalog_to_catalog` | Справочник → справочник |
| `register_to_document` | Регистр → документ-регистратор |
| `register_to_catalog` | Регистр → справочник (измерение/ресурс) |
| `subscription_to_object` | Подписка → объект-источник |
| `subscription_to_module` | Подписка → общий модуль-обработчик |
| `bsl_call` | Вызов общего модуля из BSL |
| `bsl_meta_access` | Обращение к метаданным в BSL |
| `bsl_query_ref` | Ссылка в тексте запроса |
| `based_on` | Ввод на основании |
| `owner` | Владелец справочника |
| `hierarchy` | Иерархия справочника |

## Модели данных

Основные классы определены в `models.py`:

- **ObjectInfo** — полная информация об объекте метаданных (реквизиты, ТЧ, формы, BSL)
- **DependencyGraph** — граф зависимостей с индексами по source/target/kind и методом `traverse()`
- **Edge** — ребро графа с типом `EdgeKind` и метаданными
- **RoleInfo** — роль с правами, RLS-шаблонами и ограничениями
- **BSLProcedure** — процедура/функция BSL с номером строки
- **DebugPoint** — точка остановки для отладки

## Поддерживаемые типы объектов 1С

Catalog, Document, InformationRegister, AccumulationRegister, AccountingRegister, CalculationRegister, Enum, ChartOfCharacteristicTypes, ChartOfAccounts, ChartOfCalculationTypes, BusinessProcess, Task, ExchangePlan, Report, DataProcessor, CommonModule, EventSubscription, Role, Constant, DocumentJournal, ScheduledJob, DefinedType, HTTPService, WebService.
