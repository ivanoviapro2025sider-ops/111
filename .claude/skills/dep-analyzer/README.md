# dep-analyzer — Анализатор зависимостей метаданных 1С

Production-уровневый инструмент для анализа конфигураций 1С:Предприятие 8.3, выгруженных в XML-формат (через «Конфигуратор → Конфигурация → Выгрузить конфигурацию в файлы...»).

## Архитектура

```
scripts/
├── dep-analyzer.py       # Entry-point, CLI, оркестрация
├── dep-analyzer.ps1      # PowerShell-обёртка
├── models.py             # Модели данных: ObjectInfo, Edge, DependencyGraph, ...
├── xml_helpers.py        # XML-утилиты, namespace, парсинг типов
├── scanner.py            # Сканирование Configuration.xml → индекс объектов
├── parser_catalog.py     # Парсер справочников
├── parser_document.py    # Парсер документов
├── parser_register.py    # Парсер регистров (сведений/накопления/бухгалтерии/расчёта)
├── parser_misc.py        # Парсер: подписки, общие модули, перечисления, обработки, ...
├── parser_role.py        # Парсер ролей: Rights.xml, RLS, шаблоны
├── bsl_analyzer.py       # Статический анализ BSL-кода
├── graph_builder.py      # Построение графа + обход по Depth
├── output_deps.py        # Форматированный вывод deps (text/json/md)
├── output_debug.py       # Форматированный вывод debug (text/json/md)
├── output_rights.py      # Форматированный вывод rights (text/json/md)
└── output_full.py        # Сборка всех выводов (text/json/md)
```

## Режимы работы

### deps — Граф зависимостей

Строит граф зависимостей объекта метаданных с рекурсивным обходом. Типы связей:

| Связь | Описание |
|-------|----------|
| `doc_to_register` | Документ движет регистр |
| `doc_to_catalog` | Документ ссылается на справочник |
| `doc_to_document` | Документ ссылается на документ |
| `catalog_to_catalog` | Справочник → справочник |
| `register_to_catalog` | Регистр → справочник (измерение/ресурс) |
| `subscription_to_object` | Подписка → объект-источник |
| `bsl_call` | Вызов общего модуля из BSL |
| `bsl_query_ref` | Ссылка в тексте запроса |
| `based_on` | Ввод на основании |
| `owner` / `hierarchy` | Владелец / иерархия справочника |

### debug — Точки отладки

Определяет реальные точки остановки по BSL-коду:
- Процедуры и функции модуля объекта
- Обработчики проведения документов
- Обработчики подписок на события
- Номера строк и пути к BSL-файлам

### rights — Аудит прав

Полный аудит прав доступа:
- Все роли с правами на объект
- Значения прав (Read, Update, View, Insert, Delete, ...)
- Условия RLS (ограничения на уровне записей)
- Шаблоны ограничений доступа

### full — Полный анализ

Объединяет все три режима в единый вывод.

### list — Список объектов

Просмотр объектов конфигурации с фильтрацией и пагинацией.

## Примеры

```bash
# Зависимости документа (text)
python3 scripts/dep-analyzer.py --config-path ./MyConfig --mode deps \
  --target "Document.РеализацияТоваровУслуг" --depth 5

# Точки отладки справочника (JSON)
python3 scripts/dep-analyzer.py --config-path ./MyConfig --mode debug \
  --target "Catalog.Номенклатура" --out-format json

# Аудит прав (Markdown)
python3 scripts/dep-analyzer.py --config-path ./MyConfig --mode rights \
  --target "Catalog.Контрагенты" --out-format md --out-file rights.md

# Полный анализ
python3 scripts/dep-analyzer.py --config-path ./MyConfig --mode full \
  --target "Document.ПоступлениеТоваров" --depth 3 --out-format json

# Список всех справочников
python3 scripts/dep-analyzer.py --config-path ./MyConfig --mode list \
  --target "Catalog" --out-format md
```

## Форматы Target

Поддерживается несколько форматов указания целевого объекта:

1. **Полный ключ:** `Document.РеализацияТоваровУслуг`
2. **Русский тип:** `Документ.РеализацияТоваровУслуг`
3. **Только имя:** `РеализацияТоваровУслуг` (первое совпадение)
4. **Без учёта регистра:** `реализациятовароВуслуг`

## Типы метаданных

| Тип (EN) | Тип (RU) | Папка |
|----------|----------|-------|
| Catalog | Справочник | Catalogs |
| Document | Документ | Documents |
| InformationRegister | Регистр сведений | InformationRegisters |
| AccumulationRegister | Регистр накопления | AccumulationRegisters |
| AccountingRegister | Регистр бухгалтерии | AccountingRegisters |
| CalculationRegister | Регистр расчёта | CalculationRegisters |
| Enum | Перечисление | Enums |
| ChartOfCharacteristicTypes | ПВХ | ChartsOfCharacteristicTypes |
| ChartOfAccounts | План счетов | ChartsOfAccounts |
| ChartOfCalculationTypes | План видов расчёта | ChartsOfCalculationTypes |
| BusinessProcess | Бизнес-процесс | BusinessProcesses |
| Task | Задача | Tasks |
| ExchangePlan | План обмена | ExchangePlans |
| Report | Отчёт | Reports |
| DataProcessor | Обработка | DataProcessors |
| CommonModule | Общий модуль | CommonModules |
| EventSubscription | Подписка на событие | EventSubscriptions |
| Role | Роль | Roles |
| Constant | Константа | Constants |

## Зависимости

- **Python 3.8+**
- **lxml** — парсинг XML (устанавливается автоматически через PowerShell-обёртку)

## Совместимость

- Windows: PowerShell 5.1+, Python 3.8+
- Linux/macOS: PowerShell Core 7+ (pwsh), Python 3.8+
- Форматы XML-выгрузки: EDT, Конфигуратор (оба варианта namespace)
