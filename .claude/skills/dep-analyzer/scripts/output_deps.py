"""Вывод: режим deps (text/json/md) — граф зависимостей."""

import json
from typing import Dict, List, Optional, Tuple

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo
from xml_helpers import get_type_ru

_EDGE_LABELS = {
    EdgeKind.DOC_TO_REGISTER: "движет регистр",
    EdgeKind.DOC_TO_CATALOG: "ссылается на справочник",
    EdgeKind.DOC_TO_DOCUMENT: "ссылается на документ",
    EdgeKind.CATALOG_TO_CATALOG: "ссылается на справочник",
    EdgeKind.CATALOG_TO_DOCUMENT: "ссылается на документ",
    EdgeKind.REGISTER_TO_DOCUMENT: "связан с документом",
    EdgeKind.REGISTER_TO_CATALOG: "связан со справочником",
    EdgeKind.REGISTER_TO_REGISTER: "связан с регистром",
    EdgeKind.SUBSCRIPTION_TO_OBJECT: "подписка на",
    EdgeKind.SUBSCRIPTION_TO_MODULE: "обработчик в",
    EdgeKind.BSL_CALL: "вызывает модуль",
    EdgeKind.BSL_META_ACCESS: "обращается к",
    EdgeKind.BSL_QUERY_REF: "запрос к",
    EdgeKind.BASED_ON: "ввод на основании",
    EdgeKind.OWNER: "владелец",
    EdgeKind.HIERARCHY: "иерархия",
}


def format_deps_text(graph: DependencyGraph, target: Optional[str] = None,
                     depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование зависимостей в текстовый формат."""
    lines: List[str] = []

    if target:
        lines.append(f"=== Зависимости: {target} (глубина: {depth}) ===\n")
        traversed = graph.traverse(target, depth, "both")
        _format_traversal_text(lines, graph, traversed, target)
    else:
        lines.append("=== Все зависимости конфигурации ===\n")
        _format_all_edges_text(lines, graph)

    total = len(lines)
    if offset > 0 or limit < total:
        lines = lines[offset:offset + limit]
        lines.append(f"\n--- Показано {len(lines)} из {total} строк (offset={offset}, limit={limit}) ---")

    return "\n".join(lines)


def format_deps_json(graph: DependencyGraph, target: Optional[str] = None,
                     depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование зависимостей в JSON."""
    data: Dict = {
        "mode": "deps",
        "target": target,
        "depth": depth,
    }

    if target:
        traversed = graph.traverse(target, depth, "both")
        edges_data = []
        for edge, level in traversed:
            edges_data.append(_edge_to_dict(edge, level))
        data["edges"] = edges_data[offset:offset + limit]
        data["total_edges"] = len(edges_data)
    else:
        edges_data = [_edge_to_dict(e) for e in graph.edges]
        data["edges"] = edges_data[offset:offset + limit]
        data["total_edges"] = len(edges_data)

    data["objects_count"] = len(graph.objects)
    data["offset"] = offset
    data["limit"] = limit

    return json.dumps(data, ensure_ascii=False, indent=2)


def format_deps_md(graph: DependencyGraph, target: Optional[str] = None,
                   depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование зависимостей в Markdown."""
    lines: List[str] = []

    if target:
        obj = graph.objects.get(target)
        obj_label = _format_object_label(obj) if obj else target
        lines.append(f"# Зависимости: {obj_label}\n")
        lines.append(f"**Глубина обхода:** {depth}\n")

        traversed = graph.traverse(target, depth, "both")

        outgoing = [(e, l) for e, l in traversed if e.source == target or _is_reachable_from(e, target, traversed)]
        incoming = [(e, l) for e, l in traversed if e.target == target or _is_reachable_to(e, target, traversed)]

        if outgoing:
            lines.append("## Исходящие зависимости\n")
            lines.append("| Уровень | Источник | Связь | Цель |")
            lines.append("|---------|----------|-------|------|")
            for edge, level in outgoing[:limit]:
                label = _EDGE_LABELS.get(edge.kind, edge.kind.value)
                lines.append(f"| {level} | `{edge.source}` | {label} | `{edge.target}` |")

        if incoming:
            lines.append("\n## Входящие зависимости\n")
            lines.append("| Уровень | Источник | Связь | Цель |")
            lines.append("|---------|----------|-------|------|")
            for edge, level in incoming[:limit]:
                label = _EDGE_LABELS.get(edge.kind, edge.kind.value)
                lines.append(f"| {level} | `{edge.source}` | {label} | `{edge.target}` |")
    else:
        lines.append("# Граф зависимостей конфигурации\n")
        lines.append(f"**Объектов:** {len(graph.objects)}")
        lines.append(f"**Связей:** {len(graph.edges)}\n")

        by_kind: Dict[EdgeKind, List[Edge]] = {}
        for e in graph.edges:
            by_kind.setdefault(e.kind, []).append(e)

        for kind, edges in by_kind.items():
            label = _EDGE_LABELS.get(kind, kind.value)
            lines.append(f"\n## {label} ({len(edges)})\n")
            lines.append("| Источник | Цель | Детали |")
            lines.append("|----------|------|--------|")
            for e in edges[offset:offset + limit]:
                detail = ", ".join(f"{k}={v}" for k, v in e.meta.items()) if e.meta else ""
                lines.append(f"| `{e.source}` | `{e.target}` | {detail} |")

    total = len(lines)
    lines.append(f"\n*Показано строк: {min(total, limit)}, всего: {total}, offset: {offset}*")

    return "\n".join(lines)


def _format_traversal_text(lines: List[str], graph: DependencyGraph,
                           traversed: List[Tuple[Edge, int]], target: str):
    """Форматирование результатов обхода графа в текст."""
    if not traversed:
        lines.append(f"  (нет зависимостей для {target})")
        return

    prev_level = 0
    for edge, level in traversed:
        indent = "  " * level
        label = _EDGE_LABELS.get(edge.kind, edge.kind.value)
        detail = ""
        if edge.meta:
            detail = " [" + ", ".join(f"{k}={v}" for k, v in edge.meta.items()) + "]"

        if edge.source == target or level == 1:
            lines.append(f"{indent}→ {edge.target} ({label}){detail}")
        else:
            lines.append(f"{indent}{edge.source} → {edge.target} ({label}){detail}")


def _format_all_edges_text(lines: List[str], graph: DependencyGraph):
    """Форматирование всех рёбер графа."""
    by_source: Dict[str, List[Edge]] = {}
    for e in graph.edges:
        by_source.setdefault(e.source, []).append(e)

    for source in sorted(by_source.keys()):
        lines.append(f"\n{source}:")
        for e in by_source[source]:
            label = _EDGE_LABELS.get(e.kind, e.kind.value)
            lines.append(f"  → {e.target} ({label})")


def _edge_to_dict(edge: Edge, level: int = 0) -> Dict:
    """Преобразовать ребро в словарь для JSON."""
    d = {
        "source": edge.source,
        "target": edge.target,
        "kind": edge.kind.value,
        "label": _EDGE_LABELS.get(edge.kind, edge.kind.value),
    }
    if level:
        d["level"] = level
    if edge.meta:
        d["meta"] = edge.meta
    return d


def _format_object_label(obj: ObjectInfo) -> str:
    """Форматирование метки объекта."""
    type_ru = get_type_ru(obj.obj_type)
    label = f"{type_ru} \"{obj.name}\""
    if obj.synonym:
        label += f" ({obj.synonym})"
    return label


def _is_reachable_from(edge: Edge, start: str,
                       traversed: List[Tuple[Edge, int]]) -> bool:
    """Проверить, достижим ли edge.source от start."""
    sources = {start}
    for e, l in traversed:
        if e.source in sources:
            sources.add(e.target)
    return edge.source in sources


def _is_reachable_to(edge: Edge, end: str,
                     traversed: List[Tuple[Edge, int]]) -> bool:
    """Проверить, достижим ли edge.target до end."""
    targets = {end}
    for e, l in reversed(traversed):
        if e.target in targets:
            targets.add(e.source)
    return edge.target in targets
