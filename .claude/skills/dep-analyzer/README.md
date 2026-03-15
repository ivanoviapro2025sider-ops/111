# dep-analyzer — Анализатор зависимостей метаданных 1С

## Обзор

`dep-analyzer` — инструмент для статического анализа выгруженных конфигураций 1С:Предприятие 8.3. Строит полный граф зависимостей между объектами метаданных, находит точки отладки в BSL-коде и проводит аудит прав доступа (включая RLS).

## Быстрый старт

### Требования

- Python 3.8+ с pip
- Выгруженная конфигурация 1С (XML-формат)

### Установка зависимостей

```bash
pip install lxml
```

При использовании PowerShell-обёртки `lxml` устанавливается автоматически.

### Запуск

```bash
# Зависимости объекта
python3 scripts/dep-analyzer.py \
  --config-path /path/to/config \
  --mode deps \
  --target "Document.РеализацияТоваровУслуг" \
  --depth 3

# Точки отладки
python3 scripts/dep-analyzer.py \
  --config-path /path/to/config \
  --mode debug \
  --target "Document.РеализацияТоваровУслуг"

# Аудит прав
python3 scripts/dep-analyzer.py \
  --config-path /path/to/config \
  --mode rights \
  --target "Catalog.Номенклатура" \
  --format json

# Полный анализ в Markdown
python3 scripts/dep-analyzer.py \
  --config-path /path/to/config \
  --mode full \
  --target "Document.РеализацияТоваровУслуг" \
  --format md \
  --out-file report.md
```

## Режимы работы

### deps — Граф зависимостей

Показывает все связи объекта метаданных с другими объектами:

- Какие справочники использует документ в реквизитах
- По каким регистрам делает движения
- Какие документы вводятся на основании
- Какие общие модули вызываются из BSL-кода
- Какие объекты упоминаются в запросах

### debug — Точки отладки

Анализирует BSL-модули и определяет точки остановки:

- Процедуры проведения документов (`ОбработкаПроведения`)
- Обработчики подписок на события
- Экспортные процедуры общих модулей
- Обработчики событий форм (`ПередЗаписью`, `ПриЗаписи`)

Каждая точка включает номер строки, имя модуля и контекст вызова.

### rights — Аудит прав

Для каждого объекта показывает:

- Какие роли имеют доступ
- Конкретные права (чтение, запись, просмотр, редактирование и т.д.)
- Наличие RLS-ограничений с текстом условий
- Шаблоны ограничений доступа

### full — Полный анализ

Объединяет все три режима в единый отчёт.

## Форматы вывода

| Формат | Описание |
|--------|----------|
| `text` | Текстовый формат для терминала |
| `json` | Структурированный JSON для программной обработки |
| `md` | Markdown с таблицами для документации и отчётов |

## Паттерны поиска объектов

| Паттерн | Описание |
|---------|----------|
| `Document.РеализацияТоваровУслуг` | Конкретный объект |
| `Document.*` | Все документы |
| `*.Номенклатура` | Объект по имени (любого типа) |
| `*Товар*` | Поиск по подстроке |
| (пустая строка) | Все объекты (с ограничением `--limit`) |

## Архитектура

```
scripts/
├── dep-analyzer.py      # CLI entry-point
├── dep-analyzer.ps1     # PowerShell-обёртка
├── models.py            # Модели данных (dataclasses)
├── xml_helpers.py       # XML-утилиты, namespace, парсинг типов
├── scanner.py           # Сканирование Configuration.xml
├── parser_catalog.py    # Парсер справочников
├── parser_document.py   # Парсер документов
├── parser_register.py   # Парсер регистров
├── parser_misc.py       # Парсер прочих объектов
├── parser_role.py       # Парсер ролей и прав
├── bsl_analyzer.py      # Статический анализ BSL
├── graph_builder.py     # Построение графа зависимостей
├── output_deps.py       # Вывод зависимостей
├── output_debug.py      # Вывод точек отладки
├── output_rights.py     # Вывод аудита прав
└── output_full.py       # Полный вывод
```

### Поток обработки

1. **Сканирование** (`scanner.py`): чтение `Configuration.xml`, построение индекса объектов
2. **Парсинг** (`parser_*.py`): извлечение реквизитов, типов, связей для каждого объекта
3. **BSL-анализ** (`bsl_analyzer.py`): поиск процедур, вызовов, обращений к метаданным
4. **Граф** (`graph_builder.py`): дедупликация рёбер, валидация, подготовка к обходу
5. **Вывод** (`output_*.py`): форматирование результатов по режиму и формату

### Модели данных

- `ObjectInfo` — полная информация об объекте (реквизиты, ТЧ, формы, BSL-процедуры)
- `DependencyGraph` — граф с индексами по source/target/kind и BFS-обходом
- `Edge` / `EdgeKind` — рёбра графа с 16 типами связей
- `RoleInfo` / `ObjectRights` / `RightInfo` — структура прав и RLS
- `DebugPoint` — точка остановки с контекстом и привязкой к BSL

## Поддерживаемые типы метаданных

| Тип | Английское имя | Парсер |
|-----|---------------|--------|
| Справочник | Catalog | `parser_catalog.py` |
| Документ | Document | `parser_document.py` |
| Регистр сведений | InformationRegister | `parser_register.py` |
| Регистр накопления | AccumulationRegister | `parser_register.py` |
| Регистр бухгалтерии | AccountingRegister | `parser_register.py` |
| Регистр расчёта | CalculationRegister | `parser_register.py` |
| Перечисление | Enum | `parser_misc.py` |
| План видов характеристик | ChartOfCharacteristicTypes | `parser_misc.py` |
| План счетов | ChartOfAccounts | `parser_misc.py` |
| План видов расчёта | ChartOfCalculationTypes | `parser_misc.py` |
| Бизнес-процесс | BusinessProcess | `parser_misc.py` |
| Задача | Task | `parser_misc.py` |
| План обмена | ExchangePlan | `parser_misc.py` |
| Отчёт | Report | `parser_misc.py` |
| Обработка | DataProcessor | `parser_misc.py` |
| Общий модуль | CommonModule | `parser_misc.py` |
| Подписка на событие | EventSubscription | `parser_misc.py` |
| Роль | Role | `parser_role.py` |
| Константа | Constant | `parser_misc.py` |

## Пагинация

Для больших конфигураций используйте `--limit` и `--offset`:

```bash
# Первые 50 записей
python3 dep-analyzer.py --config-path ./config --mode deps --target "Document.*" --limit 50

# Следующие 50
python3 dep-analyzer.py --config-path ./config --mode deps --target "Document.*" --limit 50 --offset 50
```
