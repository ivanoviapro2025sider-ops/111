"""Вывод: режим deps — зависимости объекта (text/json/md)."""
import json
from typing import List, Tuple, Dict, Optional

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo
from xml_helpers import get_type_ru, get_full_object_key


def format_deps(graph: DependencyGraph, target: str, depth: int = 3,
                out_format: str = "text", limit: int = 150,
                offset: int = 0) -> str:
    """Форматировать зависимости объекта.

    target: ключ объекта в графе
    depth: глубина обхода
    out_format: 'text' | 'json' | 'md'
    """
    edges_with_levels = graph.traverse(target, depth, "both")

    if out_format == "json":
        return _format_json(graph, target, edges_with_levels, depth, limit, offset)
    elif out_format == "md":
        return _format_md(graph, target, edges_with_levels, depth, limit, offset)
    else:
        return _format_text(graph, target, edges_with_levels, depth, limit, offset)


def _format_text(graph: DependencyGraph, target: str,
                 edges: List[Tuple[Edge, int]], depth: int,
                 limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_label = _object_label(obj, target)

    lines.append(f"=== Зависимости: {obj_label} ===")
    lines.append(f"Глубина: {depth}")
    lines.append("")

    outgoing = [(e, lvl) for e, lvl in edges if e.source == target or
                any(e2.target == e.source for e2, _ in edges)]
    incoming = [(e, lvl) for e, lvl in edges if e.target == target or
                any(e2.source == e.target for e2, _ in edges)]

    out_edges = [e for e in edges if _is_outgoing_from(e[0], target, edges)]
    in_edges = [e for e in edges if _is_incoming_to(e[0], target, edges)]

    lines.append("--- Исходящие зависимости (объект зависит от) ---")
    out_from_target = [(e, lvl) for e, lvl in edges if e.source == target]
    other_out = [(e, lvl) for e, lvl in edges if e.source != target and e.target != target]

    displayed = 0
    for e, lvl in out_from_target + other_out:
        if displayed < offset:
            displayed += 1
            continue
        if displayed >= offset + limit:
            break
        indent = "  " * lvl
        arrow = _edge_label(e.kind)
        lines.append(f"{indent}[{lvl}] {e.source} {arrow} {e.target}")
        displayed += 1

    lines.append("")
    lines.append("--- Входящие зависимости (от объекта зависят) ---")
    in_to_target = [(e, lvl) for e, lvl in edges if e.target == target]
    for e, lvl in in_to_target:
        indent = "  " * lvl
        arrow = _edge_label(e.kind)
        lines.append(f"{indent}[{lvl}] {e.source} {arrow} {e.target}")

    lines.append("")
    lines.append(f"Всего рёбер: {len(edges)}")

    return "\n".join(lines)


def _format_json(graph: DependencyGraph, target: str,
                 edges: List[Tuple[Edge, int]], depth: int,
                 limit: int, offset: int) -> str:
    obj = graph.objects.get(target)
    result = {
        "target": target,
        "type": obj.obj_type if obj else "",
        "name": obj.name if obj else "",
        "synonym": obj.synonym if obj else "",
        "depth": depth,
        "total_edges": len(edges),
        "edges": [],
    }

    displayed = 0
    for e, lvl in edges:
        if displayed < offset:
            displayed += 1
            continue
        if displayed >= offset + limit:
            break
        result["edges"].append({
            "source": e.source,
            "target": e.target,
            "kind": e.kind.value,
            "level": lvl,
            "meta": e.meta,
        })
        displayed += 1

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_md(graph: DependencyGraph, target: str,
               edges: List[Tuple[Edge, int]], depth: int,
               limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_label = _object_label(obj, target)

    lines.append(f"# Зависимости: {obj_label}")
    lines.append("")
    lines.append(f"**Глубина обхода:** {depth}")
    lines.append(f"**Всего рёбер:** {len(edges)}")
    lines.append("")

    lines.append("## Исходящие зависимости")
    lines.append("")
    lines.append("| Уровень | Источник | Связь | Цель |")
    lines.append("|---------|----------|-------|------|")

    displayed = 0
    for e, lvl in edges:
        if e.source == target or _has_path_from(target, e.source, edges):
            if displayed < offset:
                displayed += 1
                continue
            if displayed >= offset + limit:
                break
            lines.append(f"| {lvl} | `{e.source}` | {_edge_label(e.kind)} | `{e.target}` |")
            displayed += 1

    lines.append("")
    lines.append("## Входящие зависимости")
    lines.append("")
    lines.append("| Уровень | Источник | Связь | Цель |")
    lines.append("|---------|----------|-------|------|")

    for e, lvl in edges:
        if e.target == target or _has_path_to(target, e.target, edges):
            lines.append(f"| {lvl} | `{e.source}` | {_edge_label(e.kind)} | `{e.target}` |")

    return "\n".join(lines)


def _object_label(obj: Optional[ObjectInfo], key: str) -> str:
    if obj:
        type_ru = get_type_ru(obj.obj_type)
        label = f"{type_ru}.{obj.name}"
        if obj.synonym:
            label += f" ({obj.synonym})"
        return label
    return key


def _edge_label(kind: EdgeKind) -> str:
    labels = {
        EdgeKind.DOC_TO_REGISTER: "-->движение-->",
        EdgeKind.DOC_TO_CATALOG: "-->ссылка-->",
        EdgeKind.DOC_TO_DOCUMENT: "-->ссылка-->",
        EdgeKind.CATALOG_TO_CATALOG: "-->ссылка-->",
        EdgeKind.CATALOG_TO_DOCUMENT: "-->ссылка-->",
        EdgeKind.REGISTER_TO_DOCUMENT: "-->регистратор-->",
        EdgeKind.REGISTER_TO_CATALOG: "-->измерение/ресурс-->",
        EdgeKind.REGISTER_TO_REGISTER: "-->ссылка-->",
        EdgeKind.SUBSCRIPTION_TO_OBJECT: "-->подписка-->",
        EdgeKind.SUBSCRIPTION_TO_MODULE: "-->обработчик-->",
        EdgeKind.BSL_CALL: "-->вызов-->",
        EdgeKind.BSL_META_ACCESS: "-->обращение-->",
        EdgeKind.BSL_QUERY_REF: "-->запрос-->",
        EdgeKind.BASED_ON: "-->на основании-->",
        EdgeKind.OWNER: "-->владелец-->",
        EdgeKind.HIERARCHY: "-->иерархия-->",
    }
    return labels.get(kind, f"-->{kind.value}-->")


def _is_outgoing_from(edge: Edge, target: str,
                      all_edges: List[Tuple[Edge, int]]) -> bool:
    if edge.source == target:
        return True
    return False


def _is_incoming_to(edge: Edge, target: str,
                    all_edges: List[Tuple[Edge, int]]) -> bool:
    if edge.target == target:
        return True
    return False


def _has_path_from(start: str, node: str,
                   edges: List[Tuple[Edge, int]]) -> bool:
    visited = set()
    queue = [start]
    while queue:
        current = queue.pop(0)
        if current == node:
            return True
        if current in visited:
            continue
        visited.add(current)
        for e, _ in edges:
            if e.source == current and e.target not in visited:
                queue.append(e.target)
    return False


def _has_path_to(end: str, node: str,
                 edges: List[Tuple[Edge, int]]) -> bool:
    visited = set()
    queue = [end]
    while queue:
        current = queue.pop(0)
        if current == node:
            return True
        if current in visited:
            continue
        visited.add(current)
        for e, _ in edges:
            if e.target == current and e.source not in visited:
                queue.append(e.source)
    return False
