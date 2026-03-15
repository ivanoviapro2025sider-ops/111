"""Output formatter for dependency mode."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from graph_builder import resolve_target
from models import DependencyGraph, Edge


def _paginate(items: List[dict], limit: int, offset: int) -> Tuple[List[dict], int]:
    total = len(items)
    if limit <= 0:
        return items[offset:], total
    return items[offset : offset + limit], total


def build_deps_payload(graph: DependencyGraph, target: str = "", depth: int = 3, limit: int = 150, offset: int = 0) -> Dict[str, object]:
    resolved_target = resolve_target(graph, target) if target else None
    edges_with_levels = graph.traverse(resolved_target, depth=depth, direction="both") if resolved_target else [(edge, 1) for edge in graph.edges]

    items = [
        {
            "level": level,
            "source": edge.source,
            "target": edge.target,
            "kind": edge.kind.value,
            "meta": edge.meta,
        }
        for edge, level in edges_with_levels
    ]
    page, total = _paginate(items, limit=limit, offset=offset)
    return {
        "mode": "deps",
        "target": target,
        "resolved_target": resolved_target,
        "depth": depth,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page,
    }


def render_deps(graph: DependencyGraph, out_format: str = "text", target: str = "", depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    payload = build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Dependencies",
            "",
            f"- Target: `{payload['resolved_target'] or 'all objects'}`",
            f"- Depth: `{payload['depth']}`",
            f"- Total edges: `{payload['total']}`",
            "",
            "| Level | Kind | Source | Target | Meta |",
            "| --- | --- | --- | --- | --- |",
        ]
        for item in payload["items"]:
            meta = ", ".join(f"{key}={value}" for key, value in sorted(item["meta"].items()) if value)
            lines.append(
                f"| {item['level']} | `{item['kind']}` | `{item['source']}` | `{item['target']}` | {meta or '-'} |"
            )
        return "\n".join(lines)

    lines = [
        f"Mode: deps",
        f"Target: {payload['resolved_target'] or 'all objects'}",
        f"Depth: {payload['depth']}",
        f"Total edges: {payload['total']}",
        "",
    ]
    for item in payload["items"]:
        meta = ", ".join(f"{key}={value}" for key, value in sorted(item["meta"].items()) if value)
        lines.append(
            f"[L{item['level']}] {item['source']} --{item['kind']}--> {item['target']}" + (f" ({meta})" if meta else "")
        )
    if not payload["items"]:
        lines.append("No dependencies found.")
    return "\n".join(lines)
