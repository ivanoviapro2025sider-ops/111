"""Вывод: режим full — полная сборка: deps + debug + rights (text/json/md)."""

import json
from typing import List

from models import DependencyGraph
from xml_helpers import get_type_ru, split_object_key
from graph_builder import find_objects_by_pattern
from output_deps import format_deps
from output_debug import format_debug
from output_rights import format_rights


def format_full(graph: DependencyGraph, target: str, depth: int,
                out_format: str = "text", limit: int = 150, offset: int = 0,
                config_path: str = "") -> str:
    """Full output: dependencies + debug points + rights audit."""
    targets = find_objects_by_pattern(graph, target)
    if not targets:
        return _no_results(target, out_format)

    if out_format == "json":
        return _format_full_json(graph, target, depth, limit, offset, config_path)
    elif out_format == "md":
        return _format_full_md(graph, target, depth, limit, offset, config_path)
    else:
        return _format_full_text(graph, target, depth, limit, offset, config_path)


def _format_full_text(graph: DependencyGraph, target: str, depth: int,
                      limit: int, offset: int, config_path: str) -> str:
    sections = []

    sections.append("╔══════════════════════════════════════════════════════════╗")
    sections.append("║         ПОЛНЫЙ АНАЛИЗ ЗАВИСИМОСТЕЙ (FULL MODE)          ║")
    sections.append("╚══════════════════════════════════════════════════════════╝")
    sections.append("")

    sections.append("┌──────────────────────────────────────────────────────────┐")
    sections.append("│  РАЗДЕЛ 1: ЗАВИСИМОСТИ                                 │")
    sections.append("└──────────────────────────────────────────────────────────┘")
    deps_output = format_deps(graph, target, depth, "text", limit, offset)
    sections.append(deps_output)
    sections.append("")

    sections.append("┌──────────────────────────────────────────────────────────┐")
    sections.append("│  РАЗДЕЛ 2: ТОЧКИ ОТЛАДКИ                               │")
    sections.append("└──────────────────────────────────────────────────────────┘")
    debug_output = format_debug(graph, target, depth, "text", limit, offset, config_path)
    sections.append(debug_output)
    sections.append("")

    sections.append("┌──────────────────────────────────────────────────────────┐")
    sections.append("│  РАЗДЕЛ 3: АУДИТ ПРАВ                                  │")
    sections.append("└──────────────────────────────────────────────────────────┘")
    rights_output = format_rights(graph, target, depth, "text", limit, offset)
    sections.append(rights_output)

    return "\n".join(sections)


def _format_full_json(graph: DependencyGraph, target: str, depth: int,
                      limit: int, offset: int, config_path: str) -> str:
    deps_raw = format_deps(graph, target, depth, "json", limit, offset)
    debug_raw = format_debug(graph, target, depth, "json", limit, offset, config_path)
    rights_raw = format_rights(graph, target, depth, "json", limit, offset)

    try:
        deps_data = json.loads(deps_raw)
    except (json.JSONDecodeError, TypeError):
        deps_data = {"raw": deps_raw}

    try:
        debug_data = json.loads(debug_raw)
    except (json.JSONDecodeError, TypeError):
        debug_data = {"raw": debug_raw}

    try:
        rights_data = json.loads(rights_raw)
    except (json.JSONDecodeError, TypeError):
        rights_data = {"raw": rights_raw}

    result = {
        "mode": "full",
        "target": target,
        "depth": depth,
        "dependencies": deps_data,
        "debug": debug_data,
        "rights": rights_data,
    }

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_full_md(graph: DependencyGraph, target: str, depth: int,
                    limit: int, offset: int, config_path: str) -> str:
    sections = []

    targets = find_objects_by_pattern(graph, target)
    target_desc = ", ".join(targets[:5])
    if len(targets) > 5:
        target_desc += f" и ещё {len(targets) - 5}"

    sections.append(f"# Полный анализ: {target}")
    sections.append("")
    sections.append(f"**Объекты:** {target_desc}")
    sections.append(f"**Глубина:** {depth}")
    sections.append("")
    sections.append("---")
    sections.append("")

    sections.append("# 1. Зависимости")
    sections.append("")
    deps_output = format_deps(graph, target, depth, "md", limit, offset)
    sections.append(deps_output)
    sections.append("")
    sections.append("---")
    sections.append("")

    sections.append("# 2. Точки отладки")
    sections.append("")
    debug_output = format_debug(graph, target, depth, "md", limit, offset, config_path)
    sections.append(debug_output)
    sections.append("")
    sections.append("---")
    sections.append("")

    sections.append("# 3. Аудит прав")
    sections.append("")
    rights_output = format_rights(graph, target, depth, "md", limit, offset)
    sections.append(rights_output)

    return "\n".join(sections)


def _no_results(target: str, out_format: str) -> str:
    if out_format == "json":
        return json.dumps({"error": f"Object not found: {target}", "results": []},
                          ensure_ascii=False, indent=2)
    elif out_format == "md":
        return f"## Ошибка\n\nОбъект не найден: `{target}`"
    else:
        return f"[ERROR] Объект не найден: {target}"
