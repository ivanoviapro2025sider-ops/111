"""Build and query dependency graphs."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set, Tuple

from models import BSLCall, DependencyGraph, Edge, EdgeKind, ObjectInfo


def _register_edge(graph: DependencyGraph, edge: Edge, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    meta_key = tuple(sorted((edge.meta or {}).items()))
    key = (edge.source, edge.target, edge.kind, meta_key)
    if key in seen:
        return
    seen.add(key)
    graph.add_edge(edge)


def _reference_edge_kind(source_type: str, target_type: str, ref_kind: str) -> Optional[EdgeKind]:
    if ref_kind == "based_on":
        return EdgeKind.BASED_ON
    if ref_kind == "owner":
        return EdgeKind.OWNER
    if ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY
    if ref_kind == "bsl_meta_access":
        return EdgeKind.BSL_META_ACCESS
    if source_type == "Document":
        if "Register" in target_type:
            return EdgeKind.DOC_TO_REGISTER
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
    return None


def _resolve_unique_name(graph: DependencyGraph, name: str, preferred_type: str = "") -> Optional[str]:
    if not name:
        return None
    if "." in name and name in graph.objects:
        return name

    exact = []
    for key, obj in graph.objects.items():
        if obj.name != name:
            continue
        if preferred_type and obj.obj_type == preferred_type:
            return key
        exact.append(key)
    if len(exact) == 1:
        return exact[0]
    return None


def _add_reference_edges(graph: DependencyGraph, obj: ObjectInfo, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    for reference in obj.references:
        target = f"{reference.target_type}.{reference.target_name}"
        if target not in graph.objects:
            continue
        kind = _reference_edge_kind(obj.obj_type, reference.target_type, reference.ref_kind)
        if kind is None:
            continue
        _register_edge(
            graph,
            Edge(
                source=obj.key,
                target=target,
                kind=kind,
                meta={
                    "attribute": reference.source_attribute,
                    "tabular_section": reference.tabular_section,
                    "ref_kind": reference.ref_kind,
                },
            ),
            seen,
        )


def _add_document_edges(graph: DependencyGraph, obj: ObjectInfo, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    for target in obj.movement_registers:
        if target not in graph.objects:
            continue
        _register_edge(
            graph,
            Edge(source=obj.key, target=target, kind=EdgeKind.DOC_TO_REGISTER, meta={"source": "movement_registers"}),
            seen,
        )
    for target in obj.based_on:
        if target not in graph.objects:
            continue
        _register_edge(
            graph,
            Edge(source=obj.key, target=target, kind=EdgeKind.BASED_ON, meta={"source": "based_on"}),
            seen,
        )


def _add_bsl_call_edges(graph: DependencyGraph, obj: ObjectInfo, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    for call in obj.bsl_calls:
        target_key = _resolve_call_target(graph, call)
        if not target_key or target_key == obj.key:
            continue
        _register_edge(
            graph,
            Edge(
                source=obj.key,
                target=target_key,
                kind=EdgeKind.BSL_CALL,
                meta={"method": call.target_method, "line": str(call.source_line), "module": call.source_module},
            ),
            seen,
        )


def _resolve_call_target(graph: DependencyGraph, call: BSLCall) -> Optional[str]:
    common_module_key = _resolve_unique_name(graph, call.target_module, preferred_type="CommonModule")
    if common_module_key:
        return common_module_key
    return _resolve_unique_name(graph, call.target_module)


def _add_query_edges(graph: DependencyGraph, obj: ObjectInfo, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    for query_ref in obj.bsl_query_refs:
        target = f"{query_ref.obj_type}.{query_ref.obj_name}"
        if target not in graph.objects:
            continue
        _register_edge(
            graph,
            Edge(
                source=obj.key,
                target=target,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={"line": str(query_ref.source_line), "module": query_ref.source_module},
            ),
            seen,
        )


def _add_subscription_edges(graph: DependencyGraph, obj: ObjectInfo, seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]]) -> None:
    for source in obj.source_types:
        if source not in graph.objects:
            continue
        _register_edge(
            graph,
            Edge(source=obj.key, target=source, kind=EdgeKind.SUBSCRIPTION_TO_OBJECT, meta={"event": obj.event}),
            seen,
        )
    handler_module = obj.handler.split(".", 1)[0] if obj.handler else ""
    target_key = _resolve_unique_name(graph, handler_module, preferred_type="CommonModule")
    if target_key:
        _register_edge(
            graph,
            Edge(source=obj.key, target=target_key, kind=EdgeKind.SUBSCRIPTION_TO_MODULE, meta={"handler": obj.handler}),
            seen,
        )


def build_dependency_graph(objects: Dict[str, ObjectInfo]) -> DependencyGraph:
    graph = DependencyGraph()
    seen: Set[Tuple[str, str, EdgeKind, Tuple[Tuple[str, str], ...]]] = set()

    for obj in objects.values():
        graph.add_object(obj)
        if obj.role_info is not None:
            graph.add_role(obj.role_info)

    for obj in objects.values():
        _add_reference_edges(graph, obj, seen)
        _add_bsl_call_edges(graph, obj, seen)
        _add_query_edges(graph, obj, seen)
        if obj.obj_type == "Document":
            _add_document_edges(graph, obj, seen)
        if obj.obj_type == "EventSubscription":
            _add_subscription_edges(graph, obj, seen)

    return graph


def resolve_target(graph: DependencyGraph, target: str) -> Optional[str]:
    if not target:
        return None
    if target in graph.objects:
        return target
    return _resolve_unique_name(graph, target)


def collect_dependencies(
    graph: DependencyGraph,
    target: str,
    depth: int,
    direction: str = "both",
) -> List[Tuple[Edge, int]]:
    resolved = resolve_target(graph, target)
    if not resolved:
        return []
    return graph.traverse(resolved, depth=depth, direction=direction)
