"""Output formatters for dependency mode."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DependencyGraph


def _paginate(items: List[dict], limit: int, offset: int) -> List[dict]:
    if offset < 0:
        offset = 0
    if limit <= 0:
        return items[offset:]
    return items[offset : offset + limit]


def _build_edges_payload(graph: DependencyGraph, target: str, depth: int, direction: str) -> List[dict]:
    if target:
        edges_with_level = graph.traverse(start=target, depth=depth, direction=direction)
        return [
            {
                "level": level,
                "source": edge.source,
                "target": edge.target,
                "kind": edge.kind.value,
                "meta": edge.meta,
            }
            for edge, level in edges_with_level
        ]
    return [
        {
            "level": 1,
            "source": edge.source,
            "target": edge.target,
            "kind": edge.kind.value,
            "meta": edge.meta,
        }
        for edge in graph.edges
    ]


def render_deps(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
    direction: str = "both",
) -> str:
    payload = _build_edges_payload(graph, target=target, depth=depth, direction=direction)
    paged = _paginate(payload, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(
            {
                "mode": "deps",
                "target": target,
                "depth": depth,
                "direction": direction,
                "total": len(payload),
                "count": len(paged),
                "items": paged,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        lines = [
            "# Dependency Analyzer: deps",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Depth: `{depth}`",
            f"- Direction: `{direction}`",
            f"- Total edges: `{len(payload)}`",
            "",
            "| Level | Source | Kind | Target |",
            "|---:|---|---|---|",
        ]
        for item in paged:
            lines.append(
                f"| {item['level']} | `{item['source']}` | `{item['kind']}` | `{item['target']}` |"
            )
        return "\n".join(lines)

    lines = [
        f"Mode: deps",
        f"Target: {target or 'ALL'}",
        f"Depth: {depth}",
        f"Direction: {direction}",
        f"Total edges: {len(payload)}",
        f"Showing: {len(paged)} (offset={offset}, limit={limit})",
        "",
    ]
    for item in paged:
        lines.append(
            f"[L{item['level']}] {item['source']} --{item['kind']}--> {item['target']}"
        )
    return "\n".join(lines)

