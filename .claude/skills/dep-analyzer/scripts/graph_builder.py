"""Dependency graph builder and depth traversal helpers."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Tuple

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo, RoleInfo


def _obj_key(obj: ObjectInfo) -> str:
    return f"{obj.obj_type}.{obj.name}"


def _resolve_existing_key(objects: Dict[str, ObjectInfo], target_type: str, target_name: str) -> str:
    key = f"{target_type}.{target_name}"
    if key in objects:
        return key
    # Keep unresolved link as declared target for transparency.
    return key


def _edge_kind_for_reference(source_type: str, target_type: str, ref_kind: str) -> EdgeKind:
    if ref_kind == "based_on":
        return EdgeKind.BASED_ON
    if ref_kind == "owner":
        return EdgeKind.OWNER
    if ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY

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
    if source_type in {"InformationRegister", "AccumulationRegister", "AccountingRegister", "CalculationRegister"}:
        if target_type == "Document":
            return EdgeKind.REGISTER_TO_DOCUMENT
        if target_type in {"Catalog", "Enum", "Constant"}:
            return EdgeKind.REGISTER_TO_CATALOG
        return EdgeKind.REGISTER_TO_REGISTER

    return EdgeKind.BSL_META_ACCESS


def _iter_edges_from_references(objects: Dict[str, ObjectInfo]) -> Iterable[Edge]:
    for obj in objects.values():
        source = _obj_key(obj)
        for ref in obj.references:
            target = _resolve_existing_key(objects, ref.target_type, ref.target_name)
            kind = _edge_kind_for_reference(obj.obj_type, ref.target_type, ref.ref_kind)
            yield Edge(
                source=source,
                target=target,
                kind=kind,
                meta={
                    "source_attribute": ref.source_attribute,
                    "tabular_section": ref.tabular_section,
                    "ref_kind": ref.ref_kind,
                },
            )


def _iter_document_register_edges(objects: Dict[str, ObjectInfo]) -> Iterable[Edge]:
    register_type_names = (
        "InformationRegister",
        "AccumulationRegister",
        "AccountingRegister",
        "CalculationRegister",
    )
    for obj in objects.values():
        if obj.obj_type != "Document":
            continue
        source = _obj_key(obj)
        for movement in obj.movement_registers:
            if "." in movement:
                target = movement
            else:
                target = ""
                for register_type in register_type_names:
                    candidate = f"{register_type}.{movement}"
                    if candidate in objects:
                        target = candidate
                        break
                if not target:
                    target = movement
            yield Edge(source=source, target=target, kind=EdgeKind.DOC_TO_REGISTER, meta={"movement": movement})

        for base in obj.based_on:
            yield Edge(source=source, target=base, kind=EdgeKind.BASED_ON, meta={})


def _iter_subscription_edges(objects: Dict[str, ObjectInfo]) -> Iterable[Edge]:
    for obj in objects.values():
        if obj.obj_type != "EventSubscription":
            continue
        source = _obj_key(obj)

        for source_type in obj.source_types:
            if "." in source_type:
                target = source_type
            else:
                target = source_type
            yield Edge(
                source=source,
                target=target,
                kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                meta={"event": obj.event},
            )

        if obj.handler and "." in obj.handler:
            module_name, _ = obj.handler.split(".", 1)
            target = f"CommonModule.{module_name}"
            yield Edge(
                source=source,
                target=target,
                kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                meta={"handler": obj.handler, "event": obj.event},
            )


def _iter_bsl_edges(objects: Dict[str, ObjectInfo]) -> Iterable[Edge]:
    for obj in objects.values():
        source = _obj_key(obj)
        for call in obj.bsl_calls:
            target = f"CommonModule.{call.target_module}"
            if target not in objects:
                target = call.target_module
            yield Edge(
                source=source,
                target=target,
                kind=EdgeKind.BSL_CALL,
                meta={"method": call.target_method, "line": str(call.source_line), "module": call.source_module},
            )

        for query_ref in obj.bsl_query_refs:
            target = f"{query_ref.obj_type}.{query_ref.obj_name}"
            yield Edge(
                source=source,
                target=target,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={"line": str(query_ref.source_line), "module": query_ref.source_module},
            )


def build_dependency_graph(objects: Dict[str, ObjectInfo], roles: Optional[Dict[str, RoleInfo]] = None) -> DependencyGraph:
    """Build dependency graph from parsed metadata objects."""
    graph = DependencyGraph()
    for obj in objects.values():
        graph.add_object(obj)
    for role in (roles or {}).values():
        graph.add_role(role)

    seen = set()
    for edge in (
        list(_iter_edges_from_references(objects))
        + list(_iter_document_register_edges(objects))
        + list(_iter_subscription_edges(objects))
        + list(_iter_bsl_edges(objects))
    ):
        key = (edge.source, edge.target, edge.kind.value, tuple(sorted(edge.meta.items())))
        if key in seen:
            continue
        seen.add(key)
        graph.add_edge(edge)

    return graph


def traverse_dependencies(
    graph: DependencyGraph,
    target: str,
    depth: int,
    direction: str = "both",
) -> List[Tuple[Edge, int]]:
    """Depth-aware dependency traversal helper."""
    return graph.traverse(start=target, depth=depth, direction=direction)
