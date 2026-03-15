# dep-analyzer

`dep-analyzer` - skill для анализа XML-выгрузки конфигурации 1С. Он строит граф зависимостей, находит реальные точки остановки в BSL-модулях и собирает аудит ролей/прав, включая RLS.

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

### 1. Граф зависимостей метаданных

Поддерживаются связи:

- `Document -> Register` по движениям;
- `Document -> Catalog/Document` по типам реквизитов;
- `Catalog -> Catalog/Document` по владельцам, иерархии и ссылкам;
- `Register -> Document/Catalog/Register` по регистратору, измерениям, ресурсам и ссылкам;
- `EventSubscription -> Object/CommonModule`;
- `BSL -> CommonModule` по статически найденным вызовам;
- `BSL -> Metadata` по обращениям к метаданным и ссылкам внутри запросов.

### 2. Реальные точки отладки

Для BSL-модулей анализатор определяет:

- процедуры и функции с номерами строк;
- типовые процедуры жизненного цикла документов/справочников;
- обработчики подписок на события;
- экспортные процедуры общих модулей.

### 3. Аудит ролей и прав

Собирается:

- роль и ее общие свойства;
- права на объекты;
- наличие и текст RLS-ограничений;
- шаблоны RLS, если они присутствуют в XML.

## Запуск

### PowerShell

```powershell
./scripts/dep-analyzer.ps1 `
  -ConfigPath "C:\Exports\MyConfig" `
  -Mode deps `
  -Target "Document.Sales" `
  -Depth 3 `
  -OutFormat text
```

PowerShell-обертка:

- ищет Python в порядке `python3 -> python -> py -3`;
- проверяет наличие `lxml`;
- при необходимости вызывает `pip install lxml`;
- запускает единый entry-point `dep-analyzer.py`.

### Python

```bash
python3 "./scripts/dep-analyzer.py" \
  --config-path "/exports/my-config" \
  --mode full \
  --target "Document.Sales" \
  --depth 3 \
  --out-format json
```

## Параметры CLI

| Параметр | Описание | Значение по умолчанию |
| --- | --- | --- |
| `--config-path` / `-ConfigPath` | Путь к корню выгрузки или `Configuration.xml` | обязательно |
| `--mode` / `-Mode` | `deps`, `debug`, `rights`, `full` | `deps` |
| `--target` / `-Target` | Целевой объект или роль | пусто |
| `--depth` / `-Depth` | Глубина обхода графа | `3` |
| `--out-format` / `-OutFormat` | `text`, `json`, `md` | `text` |
| `--limit` / `-Limit` | Размер страницы | `150` |
| `--offset` / `-Offset` | Смещение | `0` |
| `--out-file` / `-OutFile` | Файл для записи результата | пусто |

## Примеры

### Зависимости

```bash
python3 "./scripts/dep-analyzer.py" \
  --config-path "/exports/my-config" \
  --mode deps \
  --target "Document.Sales" \
  --depth 2 \
  --out-format md
```

### Точки отладки

```bash
python3 "./scripts/dep-analyzer.py" \
  --config-path "/exports/my-config" \
  --mode debug \
  --target "Document.Sales" \
  --depth 2 \
  --out-format text
```

### Права по роли

```bash
python3 "./scripts/dep-analyzer.py" \
  --config-path "/exports/my-config" \
  --mode rights \
  --target "Managers" \
  --out-format json
```

### Полный отчет

```bash
python3 "./scripts/dep-analyzer.py" \
  --config-path "/exports/my-config" \
  --mode full \
  --target "Catalog.Products" \
  --depth 3 \
  --out-format json
```

## Внутренняя архитектура

### `models.py`

Общие dataclass-модели:

- `ObjectInfo`
- `DependencyGraph`
- `Edge`
- `RoleInfo`
- `DebugPoint`
- сопутствующие типы для BSL, прав и ссылок.

### `xml_helpers.py`

XML-утилиты:

- безопасный парсинг;
- XPath-хелперы;
- извлечение типов метаданных из `Type` / `TypeSet`;
- поддержка двух вариантов namespace для `xr`.

### `scanner.py`

- находит `Configuration.xml`;
- индексирует объекты по папкам и XML;
- определяет базовые пути и связанные файлы (`.bsl`, формы, команды, шаблоны).

### Парсеры

- `parser_catalog.py` - справочники;
- `parser_document.py` - документы;
- `parser_register.py` - регистры;
- `parser_misc.py` - прочие объекты;
- `parser_role.py` - роли и права.

### `bsl_analyzer.py`

- процедуры/функции;
- вызовы модулей;
- обращения к метаданным;
- ссылки на объекты в текстах запросов;
- разрешение обработчиков подписок в реальные точки остановки.

### `graph_builder.py`

- построение графа зависимостей;
- нормализация BSL-вызовов к объектам конфигурации;
- рекурсивный обход на глубину `Depth`;
- разрешение `Target`.

### Форматтеры вывода

- `output_deps.py`
- `output_debug.py`
- `output_rights.py`
- `output_full.py`

## Проверка

Во время разработки были выполнены:

- компиляция всех Python-модулей через `py_compile`;
- smoke-тест `models.py` и `xml_helpers.py`;
- интеграционный smoke-тест CLI на синтетической мини-выгрузке 1С для режимов `deps`, `debug`, `rights`.

## Ограничения и допущения

- анализ BSL сделан по статическим эвристикам;
- полностью динамические вызовы/типы без явных строковых следов могут не определиться;
- формат ролей в разных выгрузках 1С различается, поэтому часть логики аудита прав построена на устойчивых эвристиках, а не на одной жесткой схеме.
