# Skill: dep-analyzer

## Purpose

`dep-analyzer` analyzes 1C configuration XML dumps and provides:

1. Metadata dependency graph (`deps`)
2. Debug breakpoints inferred from real BSL procedures (`debug`)
3. Role rights and RLS audit (`rights`)
4. Combined report (`full`)

## Entry points

- Python: `scripts/dep-analyzer.py`
- PowerShell wrapper: `scripts/dep-analyzer.ps1`

## Supported formats

- `text`
- `json`
- `md`

## Main inputs

- `ConfigPath` (`--config-path`): path to extracted 1C XML configuration.
- `Mode`: `deps|debug|rights|full`
- `Target`: optional object key (`Document.Name`) or role/object for rights filter.
- `Depth`: graph traversal depth for dependency mode.
- `Limit`, `Offset`: pagination.

## Output modes

- `deps`: traversed dependency edges with kinds and metadata.
- `debug`: procedures and resolved handler points with line numbers.
- `rights`: object rights by role, including RLS condition when detected.
- `full`: aggregate structure with all three sections.

## Notes

- XML parsing supports both XR namespace variants:
  - `http://v8.1c.ru/8.3/xcf/readable`
  - `http://v8.3/xcf/readable`
- `lxml` is required; PowerShell wrapper auto-installs it if missing.
