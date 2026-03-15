---
name: dep-analyzer
description: Анализатор зависимостей метаданных 1С, точек остановки BSL и прав доступа, включая RLS. Используй для XML-выгрузок конфигурации, когда нужно построить граф связей, найти реальные процедуры для отладки или сделать аудит ролей.
argument-hint: <ConfigPath> [-Mode deps|debug|rights|full] [-Target <ObjectKey>] [-Depth <N>] [-OutFormat text|json|md]
allowed-tools:
  - Bash
  - Read
  - Glob
---

# /dep-analyzer — зависимости, отладка и права 1С

Skill анализирует XML-выгрузку конфигурации 1С и строит:

- граф зависимостей метаданных;
- реальные точки остановки по BSL-модулям;
- аудит ролей, прав и ограничений RLS;
- комбинированный отчёт в режимах `deps`, `debug`, `rights`, `full`.

## Быстрый запуск

```powershell
pwsh -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "<путь-к-XML-выгрузке>" `
  -Mode deps `
  -Target "Document.РеализацияТоваровУслуг"
```

На Windows допустим и `powershell.exe -File ...`.

## Параметры

| Параметр | Назначение |
|---|---|
| `-ConfigPath` | Путь к корню XML-выгрузки или к `Configuration.xml` |
| `-Mode` | `deps`, `debug`, `rights`, `full` |
| `-Target` | Объект вида `Document.Sales` или просто `Sales`, если имя уникально |
| `-Depth` | Глубина рекурсивного обхода графа для режима `deps` и секции `deps` в `full` |
| `-OutFormat` | `text`, `json`, `md` |
| `-Limit` / `-Offset` | Пагинация для `text` и `md` |
| `-OutFile` | Запись результата в файл UTF-8 BOM |

## Что умеет

### `deps`

- связи документ → регистр;
- ссылки через реквизиты, измерения, ресурсы, владельца, иерархию, ввод на основании;
- вызовы общих модулей из BSL;
- обращения к метаданным из BSL;
- ссылки на таблицы метаданных в тексте запросов;
- связи подписок на события с источниками и обработчиками;
- рекурсивный обход графа до `Depth`.

### `debug`

- процедуры документов с реальными строками в `.bsl`;
- обработчики подписок на события;
- экспортные процедуры общих модулей;
- наличие/отсутствие найденной процедуры в коде.

### `rights`

- роли и свойства роли;
- права по объектам;
- разрешения/запреты;
- RLS-признаки и текст условия;
- шаблоны ограничений.

### `full`

Объединяет `deps`, `debug`, `rights` в один отчёт.

## Примеры

```powershell
# Граф зависимостей документа в Markdown
pwsh -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "c:\dump" `
  -Mode deps `
  -Target "Document.РеализацияТоваровУслуг" `
  -Depth 4 `
  -OutFormat md

# Найти реальные точки остановки
pwsh -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "c:\dump" `
  -Mode debug `
  -Target "Document.РеализацияТоваровУслуг"

# Аудит конкретной роли
pwsh -File .claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "c:\dump" `
  -Mode rights `
  -Target "ПолныеПрава" `
  -OutFormat json
```

## Замечания

- Для BSL используется статический анализ, без исполнения кода.
- Точность зависит от полноты XML-выгрузки и наличия `.bsl`-модулей.
- Обёртка сама ищет Python (`python3`, `python`, `py -3`) и при необходимости ставит `lxml`.
