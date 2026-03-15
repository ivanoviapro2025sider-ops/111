"""Formatting for dependency output."""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from graph_builder import collect_related_nodes
from models import DependencyGraph, Edge


def _paginate(items: List[dict], limit: int, offset: int) -> List[dict]:
    if limit <= 0:
        return items[offset:]
    return items[offset : offset + limit]


def _edge_to_dict(edge: Edge, level: Optional[int] = None) -> dict:
    payload = {
        "source": edge.source,
        "target": edge.target,
        "kind": edge.kind.value,
        "meta": edge.meta,
    }
    if level is not None:
        payload["level"] = level
    return payload


def build_deps_payload(
    graph: DependencyGraph,
    *,
    target: Optional[str] = None,
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> dict:
    """Build dependency payload for all supported output formats."""

    if target and target in graph.objects:
        nodes, edges_with_levels = collect_related_nodes(graph, target, depth, direction="both")
        edge_items = [_edge_to_dict(edge, level) for edge, level in edges_with_levels]
        object_items = [
            {
                "key": key,
                "type": graph.objects[key].obj_type,
                "name": graph.objects[key].name,
                "synonym": graph.objects[key].synonym,
            }
            for key in sorted(nodes)
            if key in graph.objects
        ]
    else:
        edge_items = [_edge_to_dict(edge) for edge in graph.edges]
        object_items = [
            {
                "key": key,
                "type": obj.obj_type,
                "name": obj.name,
                "synonym": obj.synonym,
            }
            for key, obj in sorted(graph.objects.items())
        ]

    paged_edges = _paginate(edge_items, limit, offset)
    return {
        "mode": "deps",
        "target": target or "",
        "depth": depth,
        "summary": {
            "objects": len(object_items),
            "edges": len(edge_items),
            "returned_edges": len(paged_edges),
            "limit": limit,
            "offset": offset,
        },
        "objects": object_items,
        "edges": paged_edges,
    }


def render_deps(payload: dict, out_format: str = "text") -> str:
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        lines = [
            "# Dependencies",
            "",
            f"- Target: `{payload['target'] or 'ALL'}`",
            f"- Depth: `{payload['depth']}`",
            f"- Objects: `{payload['summary']['objects']}`",
            f"- Edges: `{payload['summary']['edges']}`",
            "",
            "| Source | Kind | Target | Level |",
            "| --- | --- | --- | --- |",
        ]
        for edge in payload["edges"]:
            lines.append(
                f"| `{edge['source']}` | `{edge['kind']}` | `{edge['target']}` | `{edge.get('level', '')}` |"
            )
        return "\n".join(lines)

    lines = [
        "Dependencies",
        f"Target: {payload['target'] or 'ALL'}",
        f"Depth: {payload['depth']}",
        f"Objects: {payload['summary']['objects']}",
        f"Edges: {payload['summary']['edges']}",
        "",
    ]
    for edge in payload["edges"]:
        level = f" [L{edge['level']}]" if "level" in edge else ""
        lines.append(f"- {edge['source']} --{edge['kind']}--> {edge['target']}{level}")
    return "\n".join(lines)
