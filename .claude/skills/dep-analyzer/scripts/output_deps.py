"""Форматированный вывод зависимостей: text/json/md."""

from __future__ import annotations

import json
from typing import Dict, List, Optional, Tuple

from graph_builder import collect_subgraph
from models import DependencyGraph, Edge


def _serialize_object(graph: DependencyGraph, key: str) -> Dict[str, object]:
    obj = graph.objects[key]
    return {
        "key": key,
        "name": obj.name,
        "type": obj.obj_type,
        "synonym": obj.synonym,
        "path": obj.path,
        "attributes": len(obj.attributes),
        "tabular_sections": len(obj.tabular_sections),
        "forms": obj.forms,
        "commands": obj.commands,
        "templates": obj.templates,
    }


def _serialize_edge(edge: Edge, level: int) -> Dict[str, object]:
    return {
        "source": edge.source,
        "target": edge.target,
        "kind": edge.kind.value,
        "level": level,
        "meta": edge.meta,
    }


def _format_edge_line(edge: Edge, level: int) -> str:
    meta = ", ".join(f"{key}={value}" for key, value in edge.meta.items() if value)
    suffix = f" [{meta}]" if meta else ""
    return f"L{level}: {edge.source} --{edge.kind.value}--> {edge.target}{suffix}"


def render_deps(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    direction: str = "both",
) -> str:
    """Сформировать отчёт по графу зависимостей."""

    nodes, traversed, resolved_target = collect_subgraph(graph, target=target, depth=depth, direction=direction)
    if target and not resolved_target:
        if out_format == "json":
            return json.dumps({"mode": "deps", "error": f"Target not found: {target}"}, ensure_ascii=False, indent=2)
        if out_format == "md":
            return f"# Dependencies\n\n**Error:** target not found: `{target}`"
        return f"[ERROR] Target not found: {target}"

    edges_with_level: List[Tuple[Edge, int]]
    if target:
        edges_with_level = traversed
    else:
        edges_with_level = [(edge, 1) for edge in graph.edges]

    objects_data = [_serialize_object(graph, key) for key in sorted(nodes)]
    edges_data = [_serialize_edge(edge, level) for edge, level in edges_with_level]

    if out_format == "json":
        payload = {
            "mode": "deps",
            "target": target or None,
            "resolved_target": resolved_target,
            "depth": depth,
            "direction": direction,
            "object_count": len(objects_data),
            "edge_count": len(edges_data),
            "objects": objects_data,
            "edges": edges_data,
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Dependencies",
            "",
            f"- Target: `{resolved_target or 'ALL'}`",
            f"- Depth: `{depth}`",
            f"- Direction: `{direction}`",
            f"- Objects: `{len(objects_data)}`",
            f"- Edges: `{len(edges_data)}`",
            "",
            "## Objects",
            "",
            "| Key | Type | Synonym | Attributes | Forms |",
            "| --- | --- | --- | ---: | ---: |",
        ]
        for item in objects_data:
            lines.append(
                f"| `{item['key']}` | {item['type']} | {item['synonym'] or ''} | {item['attributes']} | {len(item['forms'])} |"
            )
        lines.extend(["", "## Edges", "", "| Level | Source | Kind | Target | Meta |", "| ---: | --- | --- | --- | --- |"])
        for item in edges_data:
            meta = ", ".join(f"{key}={value}" for key, value in item["meta"].items() if value)
            lines.append(
                f"| {item['level']} | `{item['source']}` | `{item['kind']}` | `{item['target']}` | {meta} |"
            )
        return "\n".join(lines)

    lines = [
        "=== Dependencies ===",
        f"Target: {resolved_target or 'ALL'}",
        f"Depth: {depth}, Direction: {direction}",
        f"Objects: {len(objects_data)}, Edges: {len(edges_data)}",
        "",
        "Objects:",
    ]
    for item in objects_data:
        synonym = f' "{item["synonym"]}"' if item["synonym"] else ""
        lines.append(f"  - {item['key']}{synonym}")
    lines.extend(["", "Edges:"])
    lines.extend(f"  - {_format_edge_line(edge, level)}" for edge, level in edges_with_level)
    return "\n".join(lines)
