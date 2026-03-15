# dep-analyzer

Production-grade анализатор 1С-конфигурации для:

- графа зависимостей метаданных (`deps`);
- точек остановки по BSL-коду (`debug`);
- аудита прав и RLS (`rights`);
- сводного отчёта (`full`).

## Входные параметры

- `ConfigPath` — путь к каталогу выгрузки конфигурации или к `Configuration.xml`
- `Mode` — `deps | debug | rights | full`
- `Target` — необязательный целевой объект (`Document.РеализацияТоваровУслуг`)
- `Depth` — глубина рекурсивного обхода зависимостей
- `OutFormat` — `text | json | md`
- `Limit`, `Offset` — пагинация
- `OutFile` — файл вывода (опционально)

## Точка входа

- Python: `scripts/dep-analyzer.py`
- PowerShell wrapper: `scripts/dep-analyzer.ps1`

## Модули

- `models.py` — модели данных и граф
- `xml_helpers.py` — XML namespace/util helpers
- `scanner.py` — индекс объектов метаданных
- `parser_*.py` — парсеры по типам объектов
- `bsl_analyzer.py` — статический анализ BSL
- `graph_builder.py` — построение графа + traverse
- `output_*.py` — форматирование вывода
