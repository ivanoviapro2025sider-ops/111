---
name: dep-analyzer
description: Анализатор зависимостей, точек отладки и прав 1С по XML-выгрузке конфигурации. Используй для построения графа метаданных, поиска реальных процедур BSL для breakpoint, аудита ролей и RLS.
argument-hint: <ConfigPath> [-Mode deps|debug|rights|full] [-Target <объект>] [-Depth <N>] [-OutFormat text|json|md]
allowed-tools:
  - Bash
  - Read
  - Glob
---

# /dep-analyzer — зависимости, отладка и права 1С

Парсит XML-выгрузку конфигурации 1С и строит:

- граф зависимостей метаданных;
- реальные точки остановки по BSL-модулям;
- аудит ролей, прав и RLS;
- объединённый отчёт `full`.

## Запуск

```powershell
powershell.exe -NoProfile -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 -ConfigPath "<путь>"
```

Прямой запуск Python:

```bash
python3 .claude/skills/dep-analyzer/scripts/dep-analyzer.py -ConfigPath "<path>"
```

## Параметры

| Параметр | Описание |
| --- | --- |
| `ConfigPath` | Путь к корню XML-выгрузки или к `Configuration.xml` |
| `Mode` | `deps`, `debug`, `rights`, `full` |
| `Target` | Полный ключ объекта (`Document.ЗаказПокупателя`), короткое имя, путь менеджера или имя роли |
| `Depth` | Глубина рекурсивного обхода графа |
| `OutFormat` | `text`, `json`, `md` |
| `Limit` / `Offset` | Постраничный вывод для `text` / `md` |
| `OutFile` | Запись результата в UTF-8 BOM |

## Что анализируется

- **Метаданные:** справочники, документы, регистры, общие модули, подписки, роли и другие поддерживаемые типы
- **BSL:** процедуры/функции, межмодульные вызовы, обращения к менеджерам метаданных, ссылки в текстах запросов
- **Права:** объекты ролей, разрешённые и запрещённые права, RLS-ограничения и шаблоны

## Примеры

```powershell
# Полный граф зависимостей
... -ConfigPath .\dump -Mode deps

# Документ + всё связанное на глубину 4
... -ConfigPath .\dump -Mode deps -Target "Document.РеализацияТоваровУслуг" -Depth 4

# Реальные breakpoint-точки для документа и его окружения
... -ConfigPath .\dump -Mode debug -Target "РеализацияТоваровУслуг"

# Аудит конкретной роли
... -ConfigPath .\dump -Mode rights -Target "ПолныеПрава"

# Markdown-отчёт
... -ConfigPath .\dump -Mode full -OutFormat md -OutFile .\report.md
```
