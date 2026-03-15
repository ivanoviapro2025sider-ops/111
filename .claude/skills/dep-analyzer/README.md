# dep-analyzer

`dep-analyzer` — skill для анализа XML-выгрузок конфигурации 1С. Он строит граф зависимостей метаданных, находит реальные точки остановки в BSL-коде и выполняет аудит ролей/прав с поддержкой RLS.

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

Поддерживаются связи:

- `Document -> Register` по движениям;
- `Document/Catalog/Register -> *` по ссылочным типам реквизитов;
- `Catalog -> Catalog` по владельцу и иерархии;
- `Document -> Document` по вводу на основании;
- `EventSubscription -> object/module`;
- `BSL -> CommonModule` по вызовам;
- `BSL -> metadata` по обращениям `Справочники.*`, `Catalogs.*` и т.п.;
- `BSL query -> metadata` по ссылкам в строках запросов.

Граф поддерживает рекурсивный обход по глубине `Depth`.

### 2. Точки остановки (`debug`)

Анализируются `.bsl`-модули объектов и общих модулей:

- процедуры/функции с реальными номерами строк;
- ключевые процедуры документов (`ОбработкаПроведения`, `ПередЗаписью`, `ПриЗаписи` и аналоги);
- обработчики подписок на события;
- экспортные процедуры общих модулей.

### 3. Права и RLS (`rights`)

Анализируются:

- метаданные роли;
- `Rights.xml`;
- разрешённые и запрещённые права;
- признак RLS и текст ограничения;
- шаблоны ограничений.

### 4. Полный режим (`full`)

Объединяет результаты `deps`, `debug` и `rights` в одном отчёте.

## CLI

Главный entry-point: `scripts/dep-analyzer.py`

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  -ConfigPath /path/to/dump \
  -Mode deps \
  -Target Document.Sales \
  -Depth 3 \
  -OutFormat text
```

### Параметры

| Параметр | Значение по умолчанию | Описание |
|---|---:|---|
| `-ConfigPath` | — | Корень XML-выгрузки или путь к `Configuration.xml` |
| `-Mode` | `deps` | `deps`, `debug`, `rights`, `full` |
| `-Target` | `""` | Целевой объект или роль |
| `-Depth` | `3` | Глубина обхода графа |
| `-OutFormat` | `text` | `text`, `json`, `md` |
| `-Limit` | `150` | Ограничение строк для `text`/`md` |
| `-Offset` | `0` | Смещение строк для `text`/`md` |
| `-OutFile` | `""` | Сохранить результат в файл |

## PowerShell-обёртка

Для запуска из skill используется `scripts/dep-analyzer.ps1`.

Что делает обёртка:

1. ищет Python в порядке `python3 -> python -> py -3`;
2. проверяет наличие `lxml`;
3. при необходимости вызывает `pip install lxml`;
4. запускает `dep-analyzer.py` с пробросом всех параметров;
5. работает и в Windows PowerShell 5.1, и в PowerShell 7+.

Пример:

```powershell
pwsh -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "/path/to/dump" `
  -Mode full `
  -Target "Document.Sales" `
  -Depth 4 `
  -OutFormat json `
  -OutFile "./report.json"
```

## Поддерживаемые типы объектов

- Catalog
- Document
- InformationRegister
- AccumulationRegister
- AccountingRegister
- CalculationRegister
- Enum
- ChartOfCharacteristicTypes
- ChartOfAccounts
- ChartOfCalculationTypes
- BusinessProcess
- Task
- ExchangePlan
- Report
- DataProcessor
- CommonModule
- EventSubscription
- Role
- Constant
- DocumentJournal
- ScheduledJob
- DefinedType
- HTTPService
- WebService

## Ограничения

- BSL-анализ статический: динамически вычисляемые вызовы и строки запросов могут быть определены не полностью.
- XML-структуры 1С различаются между версиями и режимами выгрузки, поэтому парсеры используют эвристики по `local-name()` и типовым узлам.
- Для корректного аудита прав требуется наличие `Rights.xml` внутри выгрузки ролей.

## Проверка

Во время разработки были проверены:

- импорт и компиляция всех модулей;
- обход графа зависимостей по глубине;
- распознавание ссылочных типов и альтернативного XR namespace;
- интеграционный smoke-тест на искусственной XML-выгрузке с каталогом, документом, регистром, общим модулем, подпиской и ролью.
