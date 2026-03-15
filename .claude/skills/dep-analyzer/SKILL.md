# dep-analyzer

Production-ready analyzer for 1C metadata exports:

- dependency graph between metadata objects;
- BSL static analysis (procedures, cross-module calls, metadata references);
- debug breakpoints discovery;
- role rights and RLS audit;
- output in `text`, `json`, `md`.

## Entrypoints

- `scripts/dep-analyzer.ps1` — PowerShell wrapper (Windows PowerShell 5.1 / PowerShell 7+).
- `scripts/dep-analyzer.py` — Python CLI orchestrator.

## Modes

- `deps` — dependencies only.
- `debug` — breakpoints and handler existence.
- `rights` — roles, rights, RLS templates/conditions.
- `full` — combined report (`deps` + `debug` + `rights`).

## CLI Parameters

- `-ConfigPath` (required): path to exported 1C configuration.
- `-Mode`: `deps | debug | rights | full` (default `deps`).
- `-Target`: metadata key for focused analysis (for example, `Document.SalesInvoice`).
- `-Depth`: traversal depth for graph mode (default `3`).
- `-OutFormat`: `text | json | md` (default `text`).
- `-Limit`: pagination limit (default `150`).
- `-Offset`: pagination offset (default `0`).
- `-OutFile`: optional path to write the result.

## Notes

- Python dependencies: `lxml` only.
- PowerShell wrapper auto-detects Python in order:
  1) `python3`, 2) `python`, 3) `py -3`.
