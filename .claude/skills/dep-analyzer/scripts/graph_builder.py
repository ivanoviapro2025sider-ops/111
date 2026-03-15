"""Dependency graph construction and debug point extraction."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set, Tuple

from models import DebugPoint, DependencyGraph, Edge, EdgeKind, ObjectInfo, RoleInfo


_REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}
_DOC_DEBUG_PROCS = {
    "ОбработкаПроведения",
    "Posting",
    "ПриЗаписи",
    "OnWrite",
    "ПередЗаписью",
    "BeforeWrite",
    "ПриУдалении",
    "OnDelete",
    "ПередУдалением",
    "BeforeDelete",
}
_COMMON_OBJECT_DEBUG_PROCS = {
    "ПриЗаписи",
    "OnWrite",
    "ПередЗаписью",
    "BeforeWrite",
    "ПриОткрытии",
    "OnOpen",
}


def build_dependency_graph(object_index: Dict[str, ObjectInfo], roles: Optional[Dict[str, RoleInfo]] = None) -> DependencyGraph:
    """Build a dependency graph from parsed metadata objects."""

    graph = DependencyGraph()
    for obj_info in object_index.values():
        graph.add_object(obj_info)

    if roles:
        for role_info in roles.values():
            graph.add_role(role_info)

    for obj_info in object_index.values():
        source_key = f"{obj_info.obj_type}.{obj_info.name}"

        for ref_info in obj_info.references:
            target_key = f"{ref_info.target_type}.{ref_info.target_name}"
            edge_kind = _edge_kind_from_reference(obj_info.obj_type, ref_info.target_type, ref_info.ref_kind)
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=target_key,
                    kind=edge_kind,
                    meta={
                        "attribute": ref_info.source_attribute,
                        "tabular_section": ref_info.tabular_section,
                        "ref_kind": ref_info.ref_kind,
                    },
                )
            )

        for movement in obj_info.movement_registers:
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=movement,
                    kind=EdgeKind.DOC_TO_REGISTER,
                    meta={"source": "movement_registers"},
                )
            )

        for based_on_name in obj_info.based_on:
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=f"Document.{based_on_name}",
                    kind=EdgeKind.BASED_ON,
                    meta={"source": "based_on"},
                )
            )

        if obj_info.obj_type == "EventSubscription":
            for source_type in obj_info.source_types:
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=source_type,
                        kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                        meta={"event": obj_info.event},
                    )
                )
            if obj_info.handler:
                module_name, _, method_name = obj_info.handler.partition(".")
                target_key = f"CommonModule.{module_name}" if module_name else obj_info.handler
                graph.add_edge(
                    Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                        meta={"event": obj_info.event, "handler": obj_info.handler, "method": method_name},
                    )
                )

        for call in obj_info.bsl_calls:
            if not call.target_module:
                continue
            kind = EdgeKind.BSL_CALL if call.target_module.startswith("CommonModule.") else EdgeKind.BSL_META_ACCESS
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=call.target_module,
                    kind=kind,
                    meta={
                        "method": call.target_method,
                        "module_path": call.source_module,
                        "line": str(call.source_line),
                    },
                )
            )

        for query_ref in obj_info.bsl_query_refs:
            graph.add_edge(
                Edge(
                    source=source_key,
                    target=f"{query_ref.obj_type}.{query_ref.obj_name}",
                    kind=EdgeKind.BSL_QUERY_REF,
                    meta={"module_path": query_ref.source_module, "line": str(query_ref.source_line)},
                )
            )

    return graph


def _edge_kind_from_reference(source_type: str, target_type: str, ref_kind: str) -> EdgeKind:
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
        if target_type in _REGISTER_TYPES:
            return EdgeKind.DOC_TO_REGISTER

    if source_type == "Catalog":
        if target_type == "Catalog":
            return EdgeKind.CATALOG_TO_CATALOG
        if target_type == "Document":
            return EdgeKind.CATALOG_TO_DOCUMENT

    if source_type in _REGISTER_TYPES:
        if target_type == "Document":
            return EdgeKind.REGISTER_TO_DOCUMENT
        if target_type == "Catalog":
            return EdgeKind.REGISTER_TO_CATALOG
        if target_type in _REGISTER_TYPES:
            return EdgeKind.REGISTER_TO_REGISTER

    return EdgeKind.BSL_META_ACCESS


def resolve_target(graph: DependencyGraph, target: str) -> Optional[str]:
    """Resolve a short or full target name into a graph object key."""

    if not target:
        return None
    if target in graph.objects:
        return target

    matches = [key for key in graph.objects if key.endswith(f".{target}")]
    if len(matches) == 1:
        return matches[0]
    return None


def collect_dependency_edges(graph: DependencyGraph, target: str = "", depth: int = 3) -> List[Tuple[Edge, int]]:
    """Collect graph edges for either the whole graph or a target-centered traversal."""

    resolved_target = resolve_target(graph, target)
    if not resolved_target:
        return [(edge, 1) for edge in graph.edges]
    return graph.traverse(resolved_target, depth=depth, direction="both")


def collect_related_object_keys(graph: DependencyGraph, target: str = "", depth: int = 3) -> Set[str]:
    """Collect related object keys around a traversal target."""

    resolved_target = resolve_target(graph, target)
    if not resolved_target:
        return set(graph.objects)

    keys = {resolved_target}
    for edge, _level in graph.traverse(resolved_target, depth=depth, direction="both"):
        keys.add(edge.source)
        keys.add(edge.target)
    return keys


def collect_debug_points(graph: DependencyGraph, target: str = "", depth: int = 3) -> List[DebugPoint]:
    """Collect concrete debug points from BSL procedures and subscriptions."""

    points: List[DebugPoint] = []
    seen = set()
    scope = collect_related_object_keys(graph, target=target, depth=depth)

    for object_key in sorted(scope):
        obj_info = graph.objects.get(object_key)
        if not obj_info:
            continue

        relevant_proc_names = set()
        if obj_info.obj_type == "Document":
            relevant_proc_names |= _DOC_DEBUG_PROCS
        elif obj_info.obj_type not in {"CommonModule", "EventSubscription", "Role"}:
            relevant_proc_names |= _COMMON_OBJECT_DEBUG_PROCS

        for procedure in obj_info.procedures:
            if procedure.name not in relevant_proc_names:
                continue
            point = DebugPoint(
                procedure_name=procedure.name,
                module_path=procedure.module_path,
                line_number=procedure.line_number,
                context=_debug_context_for_object(obj_info),
                exists=True,
                source_object=obj_info.name,
                source_type=obj_info.obj_type,
            )
            signature = (point.procedure_name, point.module_path, point.line_number, point.source_object, point.source_type)
            if signature not in seen:
                seen.add(signature)
                points.append(point)

        if obj_info.obj_type == "EventSubscription" and obj_info.handler:
            module_name, _, method_name = obj_info.handler.partition(".")
            handler_obj = graph.get_object("CommonModule", module_name) if module_name else None
            matched_proc = None
            if handler_obj and method_name:
                matched_proc = next((proc for proc in handler_obj.procedures if proc.name.lower() == method_name.lower()), None)
            point = DebugPoint(
                procedure_name=method_name or obj_info.handler,
                module_path=matched_proc.module_path if matched_proc else (handler_obj.path if handler_obj else ""),
                line_number=matched_proc.line_number if matched_proc else 0,
                context=f"Подписка на событие: {obj_info.event}" if obj_info.event else "Подписка на событие",
                exists=matched_proc is not None,
                source_object=obj_info.name,
                source_type=obj_info.obj_type,
            )
            signature = (point.procedure_name, point.module_path, point.line_number, point.source_object, point.source_type)
            if signature not in seen:
                seen.add(signature)
                points.append(point)

        for call in obj_info.bsl_calls:
            if not call.target_method or not call.target_module.startswith("CommonModule."):
                continue
            target_module_name = call.target_module.split(".", 1)[1]
            target_obj = graph.get_object("CommonModule", target_module_name)
            if not target_obj:
                continue
            matched_proc = next((proc for proc in target_obj.procedures if proc.name.lower() == call.target_method.lower()), None)
            point = DebugPoint(
                procedure_name=call.target_method,
                module_path=matched_proc.module_path if matched_proc else "",
                line_number=matched_proc.line_number if matched_proc else 0,
                context=f"Вызов из {obj_info.obj_type}.{obj_info.name}",
                exists=matched_proc is not None,
                source_object=obj_info.name,
                source_type=obj_info.obj_type,
            )
            signature = (point.procedure_name, point.module_path, point.line_number, point.source_object, point.source_type)
            if signature not in seen:
                seen.add(signature)
                points.append(point)

    return sorted(points, key=lambda item: (item.source_type, item.source_object, item.module_path, item.line_number, item.procedure_name))


def _debug_context_for_object(obj_info: ObjectInfo) -> str:
    if obj_info.obj_type == "Document":
        return "Проведение/запись документа"
    if obj_info.obj_type == "Catalog":
        return "Запись справочника"
    return f"Логика объекта {obj_info.obj_type}"
