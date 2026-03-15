"""Построение графа зависимостей и рекурсивный обход по Depth."""

from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from bsl_analyzer import META_PREFIX_TO_TYPE
from models import DependencyGraph, Edge, EdgeKind, ObjectInfo, RoleInfo

REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def _reference_edge_kind(source_type: str, target_type: str, ref_kind: str) -> Optional[EdgeKind]:
    if ref_kind == "owner":
        return EdgeKind.OWNER
    if ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY
    if ref_kind == "based_on":
        return EdgeKind.BASED_ON

    if source_type == "Document" and target_type in REGISTER_TYPES:
        return EdgeKind.DOC_TO_REGISTER
    if source_type == "Document" and target_type == "Catalog":
        return EdgeKind.DOC_TO_CATALOG
    if source_type == "Document" and target_type == "Document":
        return EdgeKind.DOC_TO_DOCUMENT
    if source_type == "Catalog" and target_type == "Catalog":
        return EdgeKind.CATALOG_TO_CATALOG
    if source_type == "Catalog" and target_type == "Document":
        return EdgeKind.CATALOG_TO_DOCUMENT
    if source_type in REGISTER_TYPES and target_type == "Document":
        return EdgeKind.REGISTER_TO_DOCUMENT
    if source_type in REGISTER_TYPES and target_type == "Catalog":
        return EdgeKind.REGISTER_TO_CATALOG
    if source_type in REGISTER_TYPES and target_type in REGISTER_TYPES:
        return EdgeKind.REGISTER_TO_REGISTER
    return None


def _object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"


def _resolve_call_target(call_target_module: str, objects: Dict[str, ObjectInfo]) -> Optional[str]:
    parts = [part for part in (call_target_module or "").split(".") if part]
    if not parts:
        return None

    if len(parts) >= 2 and parts[0] in META_PREFIX_TO_TYPE:
        obj_type = META_PREFIX_TO_TYPE[parts[0]]
        target_key = _object_key(obj_type, parts[1])
        if target_key in objects:
            return target_key

    if len(parts) >= 2 and parts[0] in {"CommonModules", "ОбщиеМодули"}:
        target_key = _object_key("CommonModule", parts[1])
        if target_key in objects:
            return target_key

    direct_common_module = _object_key("CommonModule", parts[0])
    if direct_common_module in objects:
        return direct_common_module

    for candidate_key, obj_info in objects.items():
        if obj_info.name == parts[0]:
            return candidate_key
    return None


def build_dependency_graph(objects: Dict[str, ObjectInfo], roles: Dict[str, RoleInfo]) -> DependencyGraph:
    """Построить граф зависимостей по результатам парсеров и BSL-анализа."""

    graph = DependencyGraph()
    for obj_info in objects.values():
        graph.add_object(obj_info)
    for role_info in roles.values():
        graph.add_role(role_info)

    for source_key, obj_info in objects.items():
        for reference in obj_info.references:
            target_key = _object_key(reference.target_type, reference.target_name)
            if target_key not in objects:
                continue
            edge_kind = _reference_edge_kind(obj_info.obj_type, reference.target_type, reference.ref_kind)
            if edge_kind is None:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=edge_kind,
                    meta={
                        "source_attribute": reference.source_attribute,
                        "tabular_section": reference.tabular_section,
                        "ref_kind": reference.ref_kind,
                    },
                )
            )

        if obj_info.obj_type == "Document":
            for register_name in obj_info.movement_registers:
                candidates = [
                    _object_key(register_type, register_name) for register_type in REGISTER_TYPES
                ]
                for target_key in candidates:
                    if target_key in objects:
                        graph.add_edge(
                            Edge(
                                source=source_key,
                                target=target_key,
                                kind=EdgeKind.DOC_TO_REGISTER,
                                meta={"context": "movement_register"},
                            )
                        )
                        break

        if obj_info.obj_type == "EventSubscription":
            for source_type in obj_info.source_types:
                parts = source_type.split(".")
                if len(parts) >= 2:
                    target_key = _object_key(parts[0], parts[1])
                    if target_key in objects:
                        graph.add_edge(
                            Edge(
                                source=source_key,
                                target=target_key,
                                kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                                meta={"event": obj_info.event},
                            )
                        )
            if obj_info.handler:
                parts = [part for part in obj_info.handler.split(".") if part]
                if len(parts) >= 3 and parts[0] in {"CommonModules", "ОбщиеМодули"}:
                    module_name = parts[1]
                elif len(parts) >= 2:
                    module_name = parts[0]
                else:
                    module_name = ""
                if module_name:
                    target_key = _object_key("CommonModule", module_name)
                    if target_key in objects:
                        graph.add_edge(
                            Edge(
                                source=source_key,
                                target=target_key,
                                kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                                meta={"handler": obj_info.handler},
                            )
                        )

        for call in obj_info.bsl_calls:
            target_key = _resolve_call_target(call.target_module, objects)
            if not target_key:
                continue
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

        for query_ref in obj_info.bsl_query_refs:
            target_key = _object_key(query_ref.obj_type, query_ref.obj_name)
            if target_key not in objects:
                continue
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.BSL_QUERY_REF,
                    meta={
                        "source_module": query_ref.source_module,
                        "source_line": str(query_ref.source_line),
                    },
                )
            )

    return graph


def resolve_target_key(graph: DependencyGraph, target: str) -> Optional[str]:
    """Разрешить пользовательский target в полный ключ объекта."""

    if not target:
        return None
    if target in graph.objects:
        return target

    lowered = target.lower()
    for key in graph.objects:
        if key.lower() == lowered:
            return key

    if "." not in target:
        matches = [key for key, obj in graph.objects.items() if obj.name.lower() == lowered]
        if len(matches) == 1:
            return matches[0]

    parts = target.split(".")
    if len(parts) >= 2:
        prefix = parts[0]
        obj_type = META_PREFIX_TO_TYPE.get(prefix, prefix)
        candidate = _object_key(obj_type, parts[1])
        if candidate in graph.objects:
            return candidate

    return None


def collect_subgraph(
    graph: DependencyGraph,
    target: Optional[str] = None,
    depth: int = 3,
    direction: str = "both",
) -> Tuple[Set[str], List[Tuple[Edge, int]], Optional[str]]:
    """Получить набор узлов и рёбер для таргетированного обхода графа."""

    if not target:
        return set(graph.objects.keys()), [(edge, 1) for edge in graph.edges], None

    resolved_target = resolve_target_key(graph, target)
    if not resolved_target:
        return set(), [], None

    traversed = graph.traverse(resolved_target, depth=depth, direction=direction)
    nodes: Set[str] = {resolved_target}
    for edge, _level in traversed:
        nodes.add(edge.source)
        nodes.add(edge.target)
    return nodes, traversed, resolved_target
