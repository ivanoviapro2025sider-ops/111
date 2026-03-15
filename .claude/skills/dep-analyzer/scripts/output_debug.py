"""Форматированный вывод точек отладки: text/json/md."""

from __future__ import annotations

import json
from typing import Dict, List

from graph_builder import collect_subgraph
from models import DebugPoint, DependencyGraph


def _serialize_debug_point(point: DebugPoint) -> Dict[str, object]:
    return {
        "procedure_name": point.procedure_name,
        "module_path": point.module_path,
        "line_number": point.line_number,
        "context": point.context,
        "exists": point.exists,
        "source_object": point.source_object,
        "source_type": point.source_type,
    }


def render_debug(
    graph: DependencyGraph,
    debug_points: List[DebugPoint],
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
) -> str:
    """Сформировать отчёт по реальным точкам остановки."""

    target_nodes = set()
    resolved_target = None
    if target:
        target_nodes, _edges, resolved_target = collect_subgraph(graph, target=target, depth=depth, direction="both")
        if not resolved_target:
            if out_format == "json":
                return json.dumps({"mode": "debug", "error": f"Target not found: {target}"}, ensure_ascii=False, indent=2)
            if out_format == "md":
                return f"# Debug points\n\n**Error:** target not found: `{target}`"
            return f"[ERROR] Target not found: {target}"

    filtered = []
    for point in debug_points:
        source_key = f"{point.source_type}.{point.source_object}"
        if target_nodes and source_key not in target_nodes:
            continue
        filtered.append(point)

    payload = {
        "mode": "debug",
        "target": target or None,
        "resolved_target": resolved_target,
        "debug_point_count": len(filtered),
        "debug_points": [_serialize_debug_point(point) for point in filtered],
    }

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Debug points",
            "",
            f"- Target: `{resolved_target or 'ALL'}`",
            f"- Points: `{len(filtered)}`",
            "",
            "| Source | Context | Procedure | Module | Line | Exists |",
            "| --- | --- | --- | --- | ---: | :---: |",
        ]
        for point in filtered:
            lines.append(
                f"| `{point.source_type}.{point.source_object}` | {point.context} | `{point.procedure_name}` | "
                f"`{point.module_path or '-'}` | {point.line_number} | {'yes' if point.exists else 'no'} |"
            )
        return "\n".join(lines)

    lines = [
        "=== Debug points ===",
        f"Target: {resolved_target or 'ALL'}",
        f"Points: {len(filtered)}",
        "",
    ]
    for point in filtered:
        status = "OK" if point.exists else "MISSING"
        lines.append(
            f"- {point.source_type}.{point.source_object}: {point.context} -> "
            f"{point.procedure_name} ({point.module_path}:{point.line_number}) [{status}]"
        )
    return "\n".join(lines)
