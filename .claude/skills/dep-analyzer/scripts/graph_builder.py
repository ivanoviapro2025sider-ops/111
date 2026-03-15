"""Dependency graph edge builder and recursive traversal helpers."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Set

from models import DependencyGraph, Edge, EdgeKind


REGISTER_TYPE_ORDER = [
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
]


def _object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"


def _find_existing_key(graph: DependencyGraph, obj_type: str, name: str) -> Optional[str]:
    key = _object_key(obj_type, name)
    return key if key in graph.objects else None


def _find_register_key(graph: DependencyGraph, register_name: str) -> Optional[str]:
    for obj_type in REGISTER_TYPE_ORDER:
        key = _object_key(obj_type, register_name)
        if key in graph.objects:
            return key
    return None


def _edge_kind_for_reference(source_type: str, target_type: str, ref_kind: str) -> EdgeKind:
    if ref_kind == "owner":
        return EdgeKind.OWNER
    if ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY
    if ref_kind == "based_on":
        return EdgeKind.BASED_ON

    if source_type == "Document":
        if target_type == "Catalog":
            return EdgeKind.DOC_TO_CATALOG
        if target_type == "Document":
            return EdgeKind.DOC_TO_DOCUMENT
    if source_type == "Catalog":
        if target_type == "Catalog":
            return EdgeKind.CATALOG_TO_CATALOG
        if target_type == "Document":
            return EdgeKind.CATALOG_TO_DOCUMENT
    if "Register" in source_type:
        if target_type == "Document":
            return EdgeKind.REGISTER_TO_DOCUMENT
        if target_type == "Catalog":
            return EdgeKind.REGISTER_TO_CATALOG
        if "Register" in target_type:
            return EdgeKind.REGISTER_TO_REGISTER
    return EdgeKind.BSL_META_ACCESS


def build_edges(graph: DependencyGraph) -> None:
    """Populate graph.edges based on parsed metadata and BSL results."""
    graph.edges = []
    graph._edges_by_source = defaultdict(list)  # pylint: disable=protected-access
    graph._edges_by_target = defaultdict(list)  # pylint: disable=protected-access
    graph._edges_by_kind = defaultdict(list)  # pylint: disable=protected-access

    for source_key, obj in graph.objects.items():
        for ref in obj.references:
            target_key = _find_existing_key(graph, ref.target_type, ref.target_name)
            if not target_key:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=_edge_kind_for_reference(obj.obj_type, ref.target_type, ref.ref_kind),
                    meta={
                        "source_attribute": ref.source_attribute,
                        "tabular_section": ref.tabular_section,
                        "ref_kind": ref.ref_kind,
                    },
                )
            )

        if obj.obj_type == "Document":
            for register_name in obj.movement_registers:
                target_key = _find_register_key(graph, register_name)
                if not target_key:
                    continue
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.DOC_TO_REGISTER,
                        meta={"register": register_name},
                    )
                )

            for based_on_name in obj.based_on:
                target_key = _find_existing_key(graph, "Document", based_on_name)
                if not target_key:
                    continue
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.BASED_ON,
                        meta={"ref_kind": "based_on"},
                    )
                )

        if obj.obj_type == "EventSubscription":
            for source_type in obj.source_types:
                parts = source_type.split(".")
                if len(parts) != 2:
                    continue
                target_key = _find_existing_key(graph, parts[0], parts[1])
                if not target_key:
                    continue
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                        meta={"event": obj.event},
                    )
                )

            if obj.handler:
                handler_module = obj.handler.split(".")[0]
                target_key = _find_existing_key(graph, "CommonModule", handler_module)
                if target_key:
                    graph.add_edge(
                        Edge(
                            source=source_key,
                            target=target_key,
                            kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                            meta={"handler": obj.handler},
                        )
                    )

        for call in obj.bsl_calls:
            target_module_key = _find_existing_key(graph, "CommonModule", call.target_module)
            if not target_module_key:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_module_key,
                    kind=EdgeKind.BSL_CALL,
                    meta={"method": call.target_method, "line": str(call.source_line)},
                )
            )

        for query_ref in obj.bsl_query_refs:
            target_key = _find_existing_key(graph, query_ref.obj_type, query_ref.obj_name)
            if not target_key:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.BSL_QUERY_REF,
                    meta={"line": str(query_ref.source_line)},
                )
            )


def collect_subgraph(
    graph: DependencyGraph,
    start: str,
    depth: int,
    direction: str = "outgoing",
) -> List[dict]:
    """Return subgraph as serializable list with depth levels."""
    edges_with_levels = graph.traverse(start=start, depth=depth, direction=direction)
    return [
        {
            "level": level,
            "source": edge.source,
            "target": edge.target,
            "kind": edge.kind.value,
            "meta": edge.meta,
        }
        for edge, level in edges_with_levels
    ]

