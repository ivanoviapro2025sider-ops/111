"""Вывод: режим full — сборка всех выводов (deps + debug + rights)."""

import json
from typing import Dict, List, Tuple

from models import DependencyGraph, Edge, DebugPoint, RightInfo
from output_deps import format_deps
from output_debug import format_debug
from output_rights import format_rights


def format_full(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    debug_points: List[DebugPoint],
    rights_by_role: Dict[str, List[RightInfo]],
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Форматировать полный вывод: зависимости + отладка + права."""
    if out_format == "json":
        return _format_full_json(
            graph, target, edges_with_levels, debug_points, rights_by_role,
            limit, offset,
        )
    elif out_format == "md":
        return _format_full_md(
            graph, target, edges_with_levels, debug_points, rights_by_role,
            limit, offset,
        )
    else:
        return _format_full_text(
            graph, target, edges_with_levels, debug_points, rights_by_role,
            limit, offset,
        )


def _format_full_text(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    debug_points: List[DebugPoint],
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    sections = []

    deps_text = format_deps(graph, target, edges_with_levels, "text", limit, offset)
    sections.append(deps_text)

    debug_text = format_debug(graph, target, debug_points, "text", limit, offset)
    sections.append(debug_text)

    rights_text = format_rights(graph, target, rights_by_role, "text", limit, offset)
    sections.append(rights_text)

    return "\n\n" + "=" * 60 + "\n\n".join(sections)


def _format_full_json(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    debug_points: List[DebugPoint],
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    deps_json = json.loads(format_deps(graph, target, edges_with_levels, "json", limit, offset))
    debug_json = json.loads(format_debug(graph, target, debug_points, "json", limit, offset))
    rights_json = json.loads(format_rights(graph, target, rights_by_role, "json", limit, offset))

    result = {
        "target": target,
        "dependencies": deps_json,
        "debug": debug_json,
        "rights": rights_json,
    }

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_full_md(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    debug_points: List[DebugPoint],
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    from xml_helpers import get_type_ru

    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines = [
        f"# Полный анализ: {obj_type_ru} «{obj_name}»",
        "",
        "---",
        "",
    ]

    deps_md = format_deps(graph, target, edges_with_levels, "md", limit, offset)
    deps_md = deps_md.replace("# ", "## ", 1)
    lines.append(deps_md)
    lines.append("")
    lines.append("---")
    lines.append("")

    debug_md = format_debug(graph, target, debug_points, "md", limit, offset)
    debug_md = debug_md.replace("# ", "## ", 1)
    lines.append(debug_md)
    lines.append("")
    lines.append("---")
    lines.append("")

    rights_md = format_rights(graph, target, rights_by_role, "md", limit, offset)
    rights_md = rights_md.replace("# ", "## ", 1)
    lines.append(rights_md)

    return "\n".join(lines)
