"""Dependency graph builder and traversal helpers."""

from __future__ import annotations

from typing import Dict, List, Optional

from models import DebugPoint, DependencyGraph, Edge, EdgeKind, ObjectInfo, ReferenceInfo, RoleInfo


REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def _infer_edge_kind(source_obj_type: str, reference: ReferenceInfo) -> EdgeKind:
    if reference.ref_kind == "owner":
        return EdgeKind.OWNER
    if reference.ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY
    if reference.ref_kind == "based_on":
        return EdgeKind.BASED_ON
    if source_obj_type == "EventSubscription" and reference.ref_kind == "subscription_source":
        return EdgeKind.SUBSCRIPTION_TO_OBJECT
    if source_obj_type == "EventSubscription" and reference.ref_kind == "subscription_handler":
        return EdgeKind.SUBSCRIPTION_TO_MODULE

    if source_obj_type == "Document" and reference.target_type in REGISTER_TYPES:
        return EdgeKind.DOC_TO_REGISTER
    if source_obj_type == "Document" and reference.target_type == "Catalog":
        return EdgeKind.DOC_TO_CATALOG
    if source_obj_type == "Document" and reference.target_type == "Document":
        return EdgeKind.DOC_TO_DOCUMENT
    if source_obj_type == "Catalog" and reference.target_type == "Catalog":
        return EdgeKind.CATALOG_TO_CATALOG
    if source_obj_type == "Catalog" and reference.target_type == "Document":
        return EdgeKind.CATALOG_TO_DOCUMENT
    if source_obj_type in REGISTER_TYPES and reference.target_type == "Document":
        return EdgeKind.REGISTER_TO_DOCUMENT
    if source_obj_type in REGISTER_TYPES and reference.target_type == "Catalog":
        return EdgeKind.REGISTER_TO_CATALOG
    if source_obj_type in REGISTER_TYPES and reference.target_type in REGISTER_TYPES:
        return EdgeKind.REGISTER_TO_REGISTER
    return EdgeKind.BSL_META_ACCESS


def _safe_target_key(target_type: str, target_name: str) -> str:
    return f"{target_type}.{target_name}"


def build_dependency_graph(objects: Dict[str, ObjectInfo], roles: Optional[Dict[str, RoleInfo]] = None) -> DependencyGraph:
    """Build graph from parsed metadata objects."""
    graph = DependencyGraph()
    for obj in objects.values():
        graph.add_object(obj)
    if roles:
        for role_info in roles.values():
            graph.add_role(role_info)

    for obj in objects.values():
        source = f"{obj.obj_type}.{obj.name}"

        for ref in obj.references:
            target = _safe_target_key(ref.target_type, ref.target_name)
            graph.add_edge(
                Edge(
                    source=source,
                    target=target,
                    kind=_infer_edge_kind(obj.obj_type, ref),
                    meta={
                        "source_attribute": ref.source_attribute,
                        "tabular_section": ref.tabular_section,
                        "ref_kind": ref.ref_kind,
                    },
                )
            )

        if obj.obj_type == "Document":
            for based_on_name in obj.based_on:
                graph.add_edge(
                    Edge(
                        source=source,
                        target=f"Document.{based_on_name}",
                        kind=EdgeKind.BASED_ON,
                        meta={"ref_kind": "based_on"},
                    )
                )
            for register_name in obj.movement_registers:
                if "." in register_name:
                    target = register_name
                else:
                    target = f"InformationRegister.{register_name}"
                graph.add_edge(
                    Edge(
                        source=source,
                        target=target,
                        kind=EdgeKind.DOC_TO_REGISTER,
                        meta={"source": "movements"},
                    )
                )

        for call in obj.bsl_calls:
            # "CommonModuleName.Method" style is treated as common module call.
            if "." in call.target_module:
                target = call.target_module
                kind = EdgeKind.BSL_META_ACCESS
            else:
                target = f"CommonModule.{call.target_module}"
                kind = EdgeKind.BSL_CALL
            graph.add_edge(
                Edge(
                    source=source,
                    target=target,
                    kind=kind,
                    meta={
                        "target_method": call.target_method,
                        "source_line": str(call.source_line),
                    },
                )
            )

        for ref in obj.bsl_query_refs:
            graph.add_edge(
                Edge(
                    source=source,
                    target=f"{ref.obj_type}.{ref.obj_name}",
                    kind=EdgeKind.BSL_QUERY_REF,
                    meta={"source_line": str(ref.source_line)},
                )
            )

    return graph


def collect_debug_points(objects: Dict[str, ObjectInfo]) -> List[DebugPoint]:
    """Collect procedure-level debug points from all parsed BSL modules."""
    points: List[DebugPoint] = []

    for obj in objects.values():
        source_key = f"{obj.obj_type}.{obj.name}"
        for procedure in obj.procedures:
            context = "Процедура модуля"
            if obj.obj_type == "Document" and procedure.name.lower() in {
                "обработкапроведения",
                "припроведении",
                "posting",
                "beforewrite",
                "beforepost",
            }:
                context = "Проведение документа"
            points.append(
                DebugPoint(
                    procedure_name=procedure.name,
                    module_path=procedure.module_path,
                    line_number=procedure.line_number,
                    context=context,
                    exists=True,
                    source_object=source_key,
                    source_type=obj.obj_type,
                )
            )

    # Enrich event subscription handlers with resolved procedures if available.
    for obj in objects.values():
        if obj.obj_type != "EventSubscription" or not obj.handler:
            continue
        handler_parts = obj.handler.split(".")
        if len(handler_parts) < 2:
            points.append(
                DebugPoint(
                    procedure_name=obj.handler,
                    module_path="",
                    line_number=0,
                    context="Подписка на событие",
                    exists=False,
                    source_object=f"{obj.obj_type}.{obj.name}",
                    source_type=obj.obj_type,
                )
            )
            continue

        module_name = handler_parts[0]
        procedure_name = handler_parts[-1]
        module_obj = objects.get(f"CommonModule.{module_name}")
        if module_obj is None:
            points.append(
                DebugPoint(
                    procedure_name=procedure_name,
                    module_path="",
                    line_number=0,
                    context="Подписка на событие",
                    exists=False,
                    source_object=f"{obj.obj_type}.{obj.name}",
                    source_type=obj.obj_type,
                )
            )
            continue

        matches = [proc for proc in module_obj.procedures if proc.name.lower() == procedure_name.lower()]
        if matches:
            for proc in matches:
                points.append(
                    DebugPoint(
                        procedure_name=proc.name,
                        module_path=proc.module_path,
                        line_number=proc.line_number,
                        context="Подписка на событие",
                        exists=True,
                        source_object=f"{obj.obj_type}.{obj.name}",
                        source_type=obj.obj_type,
                    )
                )
        else:
            points.append(
                DebugPoint(
                    procedure_name=procedure_name,
                    module_path="",
                    line_number=0,
                    context="Подписка на событие",
                    exists=False,
                    source_object=f"{obj.obj_type}.{obj.name}",
                    source_type=obj.obj_type,
                )
            )

    points.sort(key=lambda item: (item.source_object, item.module_path, item.line_number, item.procedure_name))
    return points


def get_dependency_edges(
    graph: DependencyGraph,
    target: Optional[str],
    depth: int,
    direction: str = "outgoing",
    limit: int = 150,
    offset: int = 0,
) -> List[dict]:
    """Return traversed dependency edges in normalized dict format."""
    if target:
        traversed = graph.traverse(target, depth=depth, direction=direction)
        rows = [
            {
                "level": level,
                "source": edge.source,
                "target": edge.target,
                "kind": edge.kind.value,
                "meta": edge.meta,
            }
            for edge, level in traversed
        ]
    else:
        rows = [
            {
                "level": 1,
                "source": edge.source,
                "target": edge.target,
                "kind": edge.kind.value,
                "meta": edge.meta,
            }
            for edge in graph.edges
        ]
    return rows[offset : offset + limit]
