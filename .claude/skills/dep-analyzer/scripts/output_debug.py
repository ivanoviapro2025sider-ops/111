"""Output formatter for debug mode."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from graph_builder import collect_debug_points
from models import DependencyGraph


def _paginate(items: List[dict], limit: int, offset: int) -> Tuple[List[dict], int]:
    total = len(items)
    if limit <= 0:
        return items[offset:], total
    return items[offset : offset + limit], total


def build_debug_payload(graph: DependencyGraph, target: str = "", depth: int = 3, limit: int = 150, offset: int = 0) -> Dict[str, object]:
    debug_points = collect_debug_points(graph, target=target, depth=depth)
    items = [
        {
            "procedure_name": point.procedure_name,
            "module_path": point.module_path,
            "line_number": point.line_number,
            "context": point.context,
            "exists": point.exists,
            "source_object": point.source_object,
            "source_type": point.source_type,
        }
        for point in debug_points
    ]
    page, total = _paginate(items, limit=limit, offset=offset)
    return {
        "mode": "debug",
        "target": target,
        "depth": depth,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page,
    }


def render_debug(graph: DependencyGraph, out_format: str = "text", target: str = "", depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    payload = build_debug_payload(graph, target=target, depth=depth, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Debug Points",
            "",
            f"- Target: `{payload['target'] or 'all objects'}`",
            f"- Depth: `{payload['depth']}`",
            f"- Total points: `{payload['total']}`",
            "",
            "| Exists | Object | Procedure | Module | Line | Context |",
            "| --- | --- | --- | --- | ---: | --- |",
        ]
        for item in payload["items"]:
            exists = "yes" if item["exists"] else "no"
            object_label = f"{item['source_type']}.{item['source_object']}"
            lines.append(
                f"| {exists} | `{object_label}` | `{item['procedure_name']}` | `{item['module_path'] or '-'}` | {item['line_number']} | {item['context'] or '-'} |"
            )
        return "\n".join(lines)

    lines = [
        "Mode: debug",
        f"Target: {payload['target'] or 'all objects'}",
        f"Depth: {payload['depth']}",
        f"Total points: {payload['total']}",
        "",
    ]
    for item in payload["items"]:
        object_label = f"{item['source_type']}.{item['source_object']}"
        status = "OK" if item["exists"] else "MISSING"
        lines.append(
            f"[{status}] {object_label}: {item['procedure_name']} -> {item['module_path'] or '-'}:{item['line_number']} ({item['context'] or 'n/a'})"
        )
    if not payload["items"]:
        lines.append("No debug points found.")
    return "\n".join(lines)
