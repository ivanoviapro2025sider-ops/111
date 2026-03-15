"""Dependency graph construction and traversal helpers."""

from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo


TYPE_FOLDER_TO_OBJECT = {
    "Catalogs": "Catalog",
    "Documents": "Document",
    "InformationRegisters": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "Enums": "Enum",
    "BusinessProcesses": "BusinessProcess",
    "Tasks": "Task",
    "ExchangePlans": "ExchangePlan",
    "Reports": "Report",
    "DataProcessors": "DataProcessor",
    "CommonModules": "CommonModule",
    "EventSubscriptions": "EventSubscription",
    "Constants": "Constant",
}


def _ensure_object(graph: DependencyGraph, obj_type: str, name: str) -> str:
    key = f"{obj_type}.{name}"
    if key not in graph.objects:
        graph.add_object(ObjectInfo(name=name, obj_type=obj_type))
    return key


def _reference_edge_kind(source_type: str, target_type: str, ref_kind: str) -> EdgeKind:
    if ref_kind == "owner":
        return EdgeKind.OWNER
    if ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY
    if ref_kind == "based_on":
        return EdgeKind.BASED_ON
    if source_type == "Document" and target_type == "Document":
        return EdgeKind.DOC_TO_DOCUMENT
    if source_type == "Document":
        return EdgeKind.DOC_TO_CATALOG
    if source_type == "Catalog" and target_type == "Document":
        return EdgeKind.CATALOG_TO_DOCUMENT
    if source_type == "Catalog":
        return EdgeKind.CATALOG_TO_CATALOG
    if source_type in {
        "InformationRegister",
        "AccumulationRegister",
        "AccountingRegister",
        "CalculationRegister",
    } and target_type == "Document":
        return EdgeKind.REGISTER_TO_DOCUMENT
    if source_type in {
        "InformationRegister",
        "AccumulationRegister",
        "AccountingRegister",
        "CalculationRegister",
    } and target_type in {
        "InformationRegister",
        "AccumulationRegister",
        "AccountingRegister",
        "CalculationRegister",
    }:
        return EdgeKind.REGISTER_TO_REGISTER
    return EdgeKind.REGISTER_TO_CATALOG


def _normalize_call_target(call_target_module: str, graph: DependencyGraph) -> Optional[str]:
    if not call_target_module:
        return None

    if call_target_module in graph.objects:
        return call_target_module

    normalized = call_target_module.replace("\\", ".").replace("/", ".")
    parts = normalized.split(".")

    if parts[0] in TYPE_FOLDER_TO_OBJECT and len(parts) > 1:
        return f"{TYPE_FOLDER_TO_OBJECT[parts[0]]}.{parts[1]}"

    if parts[0] == "CommonModules" and len(parts) > 1:
        return f"CommonModule.{parts[1]}"
    if parts[0] == "ОбщиеМодули" and len(parts) > 1:
        return f"CommonModule.{parts[1]}"
    if parts[0] == "Catalogs" and len(parts) > 1:
        return f"Catalog.{parts[1]}"
    if parts[0] == "Documents" and len(parts) > 1:
        return f"Document.{parts[1]}"

    simple_common_module = f"CommonModule.{parts[0]}"
    if simple_common_module in graph.objects:
        return simple_common_module

    return None


def build_dependency_graph(objects: Dict[str, ObjectInfo]) -> DependencyGraph:
    """Build a dependency graph from parsed metadata objects."""

    graph = DependencyGraph()
    for obj_info in objects.values():
        graph.add_object(obj_info)
        if obj_info.role_info is not None:
            graph.add_role(obj_info.role_info)

    for obj_info in objects.values():
        source_key = f"{obj_info.obj_type}.{obj_info.name}"

        for reference in obj_info.references:
            target_key = _ensure_object(graph, reference.target_type, reference.target_name)
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=_reference_edge_kind(obj_info.obj_type, reference.target_type, reference.ref_kind),
                    meta={
                        "attribute": reference.source_attribute,
                        "tabular_section": reference.tabular_section,
                        "ref_kind": reference.ref_kind,
                    },
                )
            )

        if obj_info.obj_type == "Document":
            for register_key in obj_info.movement_registers:
                if "." not in register_key:
                    continue
                target_type, target_name = register_key.split(".", 1)
                target_key = _ensure_object(graph, target_type, target_name)
                graph.add_edge(Edge(source=source_key, target=target_key, kind=EdgeKind.DOC_TO_REGISTER))

            for based_on_key in obj_info.based_on:
                if "." not in based_on_key:
                    continue
                target_type, target_name = based_on_key.split(".", 1)
                target_key = _ensure_object(graph, target_type, target_name)
                graph.add_edge(Edge(source=source_key, target=target_key, kind=EdgeKind.BASED_ON))

        if obj_info.obj_type == "EventSubscription":
            for source_type in obj_info.source_types:
                if "." not in source_type:
                    continue
                target_type, target_name = source_type.split(".", 1)
                target_key = _ensure_object(graph, target_type, target_name)
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                        meta={"event": obj_info.event},
                    )
                )

            if obj_info.handler:
                handler_module = obj_info.handler.rsplit(".", 1)[0] if "." in obj_info.handler else obj_info.handler
                target_key = _normalize_call_target(handler_module, graph)
                if target_key:
                    graph.add_edge(
                        Edge(
                            source=source_key,
                            target=target_key,
                            kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                            meta={"handler": obj_info.handler, "event": obj_info.event},
                        )
                    )

        for call in obj_info.bsl_calls:
            target_key = _normalize_call_target(call.target_module, graph)
            if not target_key:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.BSL_CALL,
                    meta={
                        "source_module": call.source_module,
                        "source_line": str(call.source_line),
                        "target_method": call.target_method,
                    },
                )
            )

        for ref in getattr(obj_info, "bsl_meta_refs", []):
            target_key = _ensure_object(graph, ref.obj_type, ref.obj_name)
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.BSL_META_ACCESS,
                    meta={"source_module": ref.source_module, "source_line": str(ref.source_line)},
                )
            )

        for query_ref in obj_info.bsl_query_refs:
            target_key = _ensure_object(graph, query_ref.obj_type, query_ref.obj_name)
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.BSL_QUERY_REF,
                    meta={"source_module": query_ref.source_module, "source_line": str(query_ref.source_line)},
                )
            )

    return graph


def resolve_target(target: str, graph: DependencyGraph) -> Optional[str]:
    """Resolve target by exact key or by metadata object name."""

    if not target:
        return None
    if target in graph.objects or target in graph.roles:
        return target

    lowered = target.lower()
    exact_matches = [key for key in graph.objects if key.lower() == lowered]
    if exact_matches:
        return exact_matches[0]

    name_matches = [key for key, obj in graph.objects.items() if obj.name.lower() == lowered]
    if len(name_matches) == 1:
        return name_matches[0]

    role_matches = [name for name in graph.roles if name.lower() == lowered]
    if len(role_matches) == 1:
        return role_matches[0]

    return None


def collect_related_nodes(
    graph: DependencyGraph,
    target: str,
    depth: int,
    direction: str = "both",
) -> Tuple[Set[str], List[Tuple[Edge, int]]]:
    """Collect nodes and traversed edges for the selected target."""

    if target not in graph.objects:
        return set(), []

    edges_with_levels = graph.traverse(target, depth, direction=direction)
    nodes = {target}
    for edge, _ in edges_with_levels:
        nodes.add(edge.source)
        nodes.add(edge.target)
    return nodes, edges_with_levels
