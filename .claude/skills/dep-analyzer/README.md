# dep-analyzer

`dep-analyzer` is a modular skill for analyzing 1C configuration exports.

It provides:

1. **Dependency graph** across metadata objects (`Catalog`, `Document`, registers, subscriptions, modules, etc.).
2. **BSL static analysis**:
   - procedures/functions with line numbers;
   - calls between modules;
   - metadata and query references.
3. **Debug report** with realistic breakpoints for posting/events and handler resolution checks.
4. **Rights audit**:
   - role rights;
   - object-level permissions;
   - RLS templates and conditions.
5. **Output formats**: `text`, `json`, `md`.

## Structure

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

## Quick start

### PowerShell wrapper

```powershell
pwsh ./.claude/skills/dep-analyzer/scripts/dep-analyzer.ps1 `
  -ConfigPath "/path/to/1c-export" `
  -Mode deps `
  -Target "Document.РеализацияТоваровУслуг" `
  -Depth 4 `
  -OutFormat md
```

### Python CLI directly

```bash
python3 ./.claude/skills/dep-analyzer/scripts/dep-analyzer.py \
  -ConfigPath "/path/to/1c-export" \
  -Mode full \
  -OutFormat json \
  -OutFile "./report.json"
```

## CLI arguments

- `-ConfigPath` *(required)* — configuration export root path (or path to `Configuration.xml`).
- `-Mode` — one of:
  - `deps`
  - `debug`
  - `rights`
  - `full`
- `-Target` — metadata object key for focused output (for example, `Catalog.Номенклатура`).
- `-Depth` — recursion depth for graph traversal.
- `-OutFormat` — `text | json | md`.
- `-Limit` / `-Offset` — pagination controls.
- `-OutFile` — optional file output path.

## PowerShell compatibility

The wrapper is compatible with:

- Windows PowerShell **5.1**
- PowerShell **7+** (Windows/Linux/macOS)

Runtime behavior:

1. Detect Python in priority order: `python3`, `python`, `py -3`.
2. Ensure `lxml` is installed (`pip install lxml` if needed).
3. Execute `dep-analyzer.py` with all CLI parameters forwarded.

## Technical notes

- `models.py` contains all shared contracts:
  - metadata object model;
  - role/rights model;
  - graph model and depth traversal.
- `xml_helpers.py` handles resilient XML parsing and 1C type extraction.
- Namespace handling includes both XR forms:
  - `http://v8.1c.ru/8.3/xcf/readable`
  - `http://v8.3/xcf/readable`
