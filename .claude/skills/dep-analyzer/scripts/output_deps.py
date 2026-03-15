"""Dependency output renderers."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from graph_builder import collect_dependencies, resolve_target
from models import DependencyGraph, Edge


def build_deps_payload(
    graph: DependencyGraph,
    target: str,
    depth: int,
    direction: str = "both",
) -> Dict[str, object]:
    resolved = resolve_target(graph, target) if target else None
    edges_with_levels: List[Tuple[Edge, int]] = collect_dependencies(graph, target, depth, direction) if resolved else []
    target_obj = graph.objects.get(resolved) if resolved else None
    return {
        "mode": "deps",
        "target": resolved or target,
        "depth": depth,
        "direction": direction,
        "object": {
            "key": target_obj.key,
            "name": target_obj.name,
            "type": target_obj.obj_type,
            "synonym": target_obj.synonym,
        }
        if target_obj
        else None,
        "total_edges": len(edges_with_levels),
        "edges": [
            {
                "level": level,
                "kind": edge.kind.value,
                "source": edge.source,
                "target": edge.target,
                "meta": edge.meta,
            }
            for edge, level in edges_with_levels
        ],
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [
        f"=== Dependencies: {payload.get('target') or '(not found)'} ===",
        f"Depth: {payload['depth']}, direction: {payload['direction']}",
        "",
    ]
    if not payload.get("object"):
        lines.append("Target object not found.")
        return "\n".join(lines)

    edges = payload["edges"]
    if not edges:
        lines.append("No dependencies found for requested depth.")
        return "\n".join(lines)

    lines.append("Edges:")
    for item in edges:
        meta = item["meta"] or {}
        meta_text = ", ".join(f"{key}={value}" for key, value in meta.items() if value)
        suffix = f" [{meta_text}]" if meta_text else ""
        lines.append(
            f"  L{item['level']}: {item['source']} -[{item['kind']}]-> {item['target']}{suffix}"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [
        f"# Dependencies: {payload.get('target') or '(not found)'}",
        "",
        f"- Depth: `{payload['depth']}`",
        f"- Direction: `{payload['direction']}`",
        f"- Total edges: `{payload['total_edges']}`",
        "",
    ]
    if not payload.get("object"):
        lines.append("Target object not found.")
        return "\n".join(lines)

    if not payload["edges"]:
        lines.append("No dependencies found for requested depth.")
        return "\n".join(lines)

    lines.extend(["| Level | Kind | Source | Target | Meta |", "|---:|---|---|---|---|"])
    for item in payload["edges"]:
        meta_text = ", ".join(f"{key}={value}" for key, value in (item["meta"] or {}).items() if value)
        lines.append(
            f"| {item['level']} | `{item['kind']}` | `{item['source']}` | `{item['target']}` | {meta_text or '-'} |"
        )
    return "\n".join(lines)


def render_deps(
    graph: DependencyGraph,
    target: str,
    depth: int,
    out_format: str = "text",
    direction: str = "both",
) -> str:
    payload = build_deps_payload(graph, target=target, depth=depth, direction=direction)
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
