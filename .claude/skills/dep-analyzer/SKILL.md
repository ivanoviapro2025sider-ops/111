# dep-analyzer

Production-ready skill for static analysis of 1C metadata export:

- dependency graph (metadata references + BSL links + event subscriptions);
- debug points (procedures with real source line numbers);
- rights audit (role rights + RLS conditions/templates);
- recursive traversal by depth;
- output formats: `text`, `json`, `md`.

## Entry points

- PowerShell wrapper: `scripts/dep-analyzer.ps1`
- Python CLI: `scripts/dep-analyzer.py`

## Parameters

- `ConfigPath` / `--config-path` (required): path to exported configuration.
- `Mode` / `--mode`: `deps` | `debug` | `rights` | `full`.
- `Target` / `--target`: object key like `Document.РеализацияТоваровУслуг`.
- `Depth` / `--depth`: recursive depth for graph traversal.
- `OutFormat` / `--out-format`: `text` | `json` | `md`.
- `Limit` / `--limit`: page size.
- `Offset` / `--offset`: page offset.
- `OutFile` / `--out-file`: optional path to write output.

## Pipeline

1. `scanner.py` scans configuration folders and creates object index.
2. `parser_*.py` enrich objects with attributes, references and rights.
3. `bsl_analyzer.py` extracts procedures/calls/metadata access from BSL.
4. `graph_builder.py` builds typed dependency edges.
5. `output_*.py` formats mode-specific response.

