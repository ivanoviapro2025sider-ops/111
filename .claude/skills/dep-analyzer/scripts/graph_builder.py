"""Dependency graph builder and recursive traversal helpers."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo, RoleInfo

REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def _find_object_key(objects: Dict[str, ObjectInfo], obj_type: str, name: str) -> Optional[str]:
    key = f"{obj_type}.{name}"
    if key in objects:
        return key
    # fallback by suffix for inconsistent names in dump
    suffix = f".{name}"
    for candidate_key in objects:
        if candidate_key.endswith(suffix) and candidate_key.startswith(f"{obj_type}."):
            return candidate_key
    return None


def _detect_register_target_key(objects: Dict[str, ObjectInfo], register_name: str) -> Optional[str]:
    for reg_type in REGISTER_TYPES:
        key = _find_object_key(objects, reg_type, register_name)
        if key:
            return key
    return None


def _add_reference_edge(graph: DependencyGraph, source_key: str, obj: ObjectInfo, ref) -> None:
    target_key = _find_object_key(graph.objects, ref.target_type, ref.target_name)
    if not target_key:
        target_key = f"{ref.target_type}.{ref.target_name}"

    if obj.obj_type == "Document" and ref.target_type == "Catalog":
        kind = EdgeKind.DOC_TO_CATALOG
    elif obj.obj_type == "Document" and ref.target_type == "Document":
        kind = EdgeKind.DOC_TO_DOCUMENT
    elif obj.obj_type == "Catalog" and ref.target_type == "Catalog":
        kind = EdgeKind.CATALOG_TO_CATALOG
    elif obj.obj_type == "Catalog" and ref.target_type == "Document":
        kind = EdgeKind.CATALOG_TO_DOCUMENT
    elif obj.obj_type in REGISTER_TYPES and ref.target_type == "Document":
        kind = EdgeKind.REGISTER_TO_DOCUMENT
    elif obj.obj_type in REGISTER_TYPES and ref.target_type in {"Catalog", *REGISTER_TYPES}:
        kind = (
            EdgeKind.REGISTER_TO_REGISTER
            if ref.target_type in REGISTER_TYPES
            else EdgeKind.REGISTER_TO_CATALOG
        )
    elif ref.ref_kind == "owner":
        kind = EdgeKind.OWNER
    elif ref.ref_kind == "hierarchy":
        kind = EdgeKind.HIERARCHY
    elif ref.ref_kind == "based_on":
        kind = EdgeKind.BASED_ON
    else:
        return

    graph.add_edge(
        Edge(
            source=source_key,
            target=target_key,
            kind=kind,
            meta={
                "source_attribute": ref.source_attribute,
                "tabular_section": ref.tabular_section,
                "ref_kind": ref.ref_kind,
            },
        )
    )


def _build_bsl_edges(graph: DependencyGraph, source_key: str, obj: ObjectInfo) -> None:
    for call in obj.bsl_calls:
        module_name = call.target_module
        target_key = _find_object_key(graph.objects, "CommonModule", module_name)
        if not target_key:
            # fallback for calls to metadata collections (e.g., Справочники.Номенклатура.Найти...)
            for obj_type in (
                "Catalog",
                "Document",
                "InformationRegister",
                "AccumulationRegister",
                "AccountingRegister",
                "CalculationRegister",
            ):
                guess_key = _find_object_key(graph.objects, obj_type, module_name)
                if guess_key:
                    target_key = guess_key
                    break
        if not target_key:
            target_key = f"CommonModule.{module_name}"

        graph.add_edge(
            Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.BSL_CALL,
                meta={
                    "method": call.target_method,
                    "source_module": call.source_module,
                    "source_line": str(call.source_line),
                },
            )
        )

    for qref in obj.bsl_query_refs:
        target_key = _find_object_key(graph.objects, qref.obj_type, qref.obj_name) or f"{qref.obj_type}.{qref.obj_name}"
        graph.add_edge(
            Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={
                    "source_module": qref.source_module,
                    "source_line": str(qref.source_line),
                },
            )
        )


def _build_subscription_edges(graph: DependencyGraph, source_key: str, obj: ObjectInfo) -> None:
    for source_type in obj.source_types:
        if "." in source_type:
            target_type, target_name = source_type.split(".", 1)
            target_key = _find_object_key(graph.objects, target_type, target_name) or source_type
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                    meta={"event": obj.event},
                )
            )
    if obj.handler:
        module_name = obj.handler.split(".", 1)[0]
        target_key = _find_object_key(graph.objects, "CommonModule", module_name) or f"CommonModule.{module_name}"
        graph.add_edge(
            Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                meta={"handler": obj.handler, "event": obj.event},
            )
        )


def build_dependency_graph(
    objects: Dict[str, ObjectInfo],
    roles: Optional[Dict[str, RoleInfo]] = None,
) -> DependencyGraph:
    """Build DependencyGraph from parsed metadata objects."""
    graph = DependencyGraph()

    for obj in objects.values():
        graph.add_object(obj)

    if roles:
        for role in roles.values():
            graph.add_role(role)

    for source_key, obj in graph.objects.items():
        for ref in obj.references:
            _add_reference_edge(graph, source_key, obj, ref)

        if obj.obj_type == "Document":
            for register_name in obj.movement_registers:
                target_key = _detect_register_target_key(graph.objects, register_name)
                if not target_key:
                    target_key = f"Register.{register_name}"
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.DOC_TO_REGISTER,
                        meta={"register_name": register_name},
                    )
                )

            for based_on_name in obj.based_on:
                target_key = _find_object_key(graph.objects, "Document", based_on_name) or f"Document.{based_on_name}"
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.BASED_ON,
                        meta={"source_attribute": "BasedOn"},
                    )
                )

        if obj.obj_type == "EventSubscription":
            _build_subscription_edges(graph, source_key, obj)

        _build_bsl_edges(graph, source_key, obj)

    return graph


def traverse_dependencies(
    graph: DependencyGraph,
    start: str,
    depth: int,
    direction: str = "outgoing",
) -> List[tuple[Edge, int]]:
    """Convenience wrapper around DependencyGraph.traverse."""
    return graph.traverse(start=start, depth=depth, direction=direction)
