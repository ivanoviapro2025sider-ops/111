---
name: dep-analyzer
description: Анализатор зависимостей метаданных 1С, точек отладки BSL и аудита прав/RLS по выгрузке конфигурации.
entrypoint:
  python: scripts/dep-analyzer.py
  powershell: scripts/dep-analyzer.ps1
outputs:
  - text
  - json
  - md
---

# dep-analyzer

## Назначение

Skill анализирует выгрузку конфигурации 1С и строит:

- граф зависимостей между объектами метаданных;
- реальные точки остановки в BSL-модулях;
- аудит ролей, прав и RLS;
- комбинированный вывод в режиме `full`.

## Поддерживаемые режимы

- `deps` — зависимости и рекурсивный обход по `Depth`;
- `debug` — точки остановки по BSL и обработчикам подписок;
- `rights` — права ролей, включая RLS и шаблоны ограничений;
- `full` — сборка всех режимов в одном выводе.

## Параметры

- `ConfigPath` — путь к каталогу выгрузки конфигурации;
- `Mode` — `deps|debug|rights|full`;
- `Target` — имя объекта или полный ключ вида `Catalog.Номенклатура`;
- `Depth` — глубина обхода графа;
- `OutFormat` — `text|json|md`;
- `Limit` / `Offset` — пагинация;
- `OutFile` — путь к файлу результата.

## Быстрый запуск

### PowerShell

```powershell
./scripts/dep-analyzer.ps1 `
  -ConfigPath "C:\dump\MyConfig" `
  -Mode full `
  -Target "Document.РеализацияТоваровУслуг" `
  -Depth 4 `
  -OutFormat md
```

### Python

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  --config-path /path/to/dump \
  --mode deps \
  --target "Catalog.Номенклатура" \
  --depth 3 \
  --out-format json
```
