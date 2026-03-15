"""Output rendering for deps mode."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from models import DependencyGraph, Edge


def _edge_to_dict(edge: Edge, level: int) -> Dict[str, object]:
    return {
        "level": level,
        "source": edge.source,
        "target": edge.target,
        "kind": edge.kind.value,
        "meta": edge.meta,
    }


def build_deps_payload(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> Dict[str, object]:
    if target:
        traversed: List[Tuple[Edge, int]] = graph.traverse(start=target, depth=depth, direction="both")
    else:
        traversed = [(edge, 1) for edge in graph.edges]

    total = len(traversed)
    sliced = traversed[offset : offset + limit] if limit >= 0 else traversed[offset:]
    edges = [_edge_to_dict(edge, level) for edge, level in sliced]

    return {
        "mode": "deps",
        "target": target,
        "depth": depth,
        "total_edges": total,
        "returned_edges": len(edges),
        "offset": offset,
        "limit": limit,
        "edges": edges,
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [
        f"Mode: {payload['mode']}",
        f"Target: {payload['target'] or '<all>'}",
        f"Depth: {payload['depth']}",
        f"Edges: {payload['returned_edges']}/{payload['total_edges']}",
        "",
    ]
    for item in payload["edges"]:
        lines.append(
            f"[L{item['level']}] {item['source']} --({item['kind']})--> {item['target']}"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [
        "# Dependency Analysis",
        "",
        f"- **Target:** `{payload['target'] or '<all>'}`",
        f"- **Depth:** `{payload['depth']}`",
        f"- **Edges:** `{payload['returned_edges']}/{payload['total_edges']}`",
        "",
        "| Level | Source | Kind | Target |",
        "|---:|---|---|---|",
    ]
    for item in payload["edges"]:
        lines.append(
            f"| {item['level']} | `{item['source']}` | `{item['kind']}` | `{item['target']}` |"
        )
    return "\n".join(lines)


def render_deps(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    payload = build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
