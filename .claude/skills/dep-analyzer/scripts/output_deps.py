"""Output formatter for deps mode."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from models import DependencyGraph, Edge


def _edge_to_dict(edge: Edge, level: int = 0) -> Dict[str, object]:
    return {
        "source": edge.source,
        "target": edge.target,
        "kind": edge.kind.value,
        "level": level,
        "meta": edge.meta,
    }


def _collect_edges(
    graph: DependencyGraph,
    target: str,
    depth: int,
    direction: str = "both",
) -> List[Tuple[Edge, int]]:
    if target:
        return graph.traverse(start=target, depth=depth, direction=direction)
    return [(edge, 0) for edge in graph.edges]


def _paginate(items: List[Tuple[Edge, int]], limit: int, offset: int) -> List[Tuple[Edge, int]]:
    if offset < 0:
        offset = 0
    if limit <= 0:
        return items[offset:]
    return items[offset : offset + limit]


def format_deps(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
    direction: str = "both",
) -> str:
    """Format dependencies output in text/json/markdown."""
    edges_with_level = _collect_edges(graph, target=target, depth=depth, direction=direction)
    total = len(edges_with_level)
    page = _paginate(edges_with_level, limit=limit, offset=offset)
    edge_dicts = [_edge_to_dict(edge, level) for edge, level in page]

    payload = {
        "mode": "deps",
        "target": target,
        "depth": depth,
        "direction": direction,
        "total": total,
        "count": len(edge_dicts),
        "offset": offset,
        "limit": limit,
        "items": edge_dicts,
    }

    fmt = out_format.lower()
    if fmt == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if fmt in {"md", "markdown"}:
        lines = [
            "# Dependency Analysis",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Depth: `{depth}`",
            f"- Direction: `{direction}`",
            f"- Total edges: `{total}`",
            f"- Page count: `{len(edge_dicts)}` (offset={offset}, limit={limit})",
            "",
            "| Level | Source | Kind | Target | Meta |",
            "|---:|---|---|---|---|",
        ]
        for item in edge_dicts:
            meta_str = ", ".join(f"{k}={v}" for k, v in item["meta"].items()) if item["meta"] else ""
            lines.append(
                f"| {item['level']} | `{item['source']}` | `{item['kind']}` | `{item['target']}` | {meta_str} |"
            )
        return "\n".join(lines)

    lines = [
        "Dependencies",
        f"Target: {target or 'ALL'} | Depth: {depth} | Direction: {direction}",
        f"Total: {total} | Showing: {len(edge_dicts)} | Offset: {offset} | Limit: {limit}",
        "",
    ]
    for item in edge_dicts:
        meta = ", ".join(f"{k}={v}" for k, v in item["meta"].items()) if item["meta"] else "-"
        lines.append(f"[L{item['level']}] {item['source']} --{item['kind']}--> {item['target']} ({meta})")
    return "\n".join(lines)
