"""Построение графа зависимостей + рекурсивный обход по Depth."""

from typing import Dict, List, Optional, Set

from models import (
    DependencyGraph, ObjectInfo, Edge, EdgeKind, ReferenceInfo,
    DebugPoint, RoleInfo,
)
from xml_helpers import get_full_object_key


def build_graph(objects: Dict[str, ObjectInfo]) -> DependencyGraph:
    """Построить полный граф зависимостей из индекса объектов.

    objects: dict {"Catalog.Номенклатура": ObjectInfo, ...}
    Returns: DependencyGraph
    """
    graph = DependencyGraph()

    for key, obj_info in objects.items():
        graph.add_object(obj_info)

    for key, obj_info in objects.items():
        _build_reference_edges(graph, obj_info)
        _build_movement_edges(graph, obj_info)
        _build_subscription_edges(graph, obj_info)
        _build_bsl_edges(graph, obj_info)

        if obj_info.role_info:
            graph.add_role(obj_info.role_info)

    return graph


def _build_reference_edges(graph: DependencyGraph, obj_info: ObjectInfo):
    """Создать рёбра из ссылок (references) объекта."""
    source_key = get_full_object_key(obj_info.obj_type, obj_info.name)

    movement_targets = set()
    if obj_info.obj_type == "Document":
        for mr in obj_info.movement_registers:
            movement_targets.add(mr)

    for ref in obj_info.references:
        target_key = get_full_object_key(ref.target_type, ref.target_name)

        if target_key not in graph.objects:
            continue

        if ref.source_attribute == "RegisterRecords" and target_key in movement_targets:
            continue

        kind = _resolve_edge_kind(obj_info.obj_type, ref)

        meta = {"attribute": ref.source_attribute}
        if ref.tabular_section:
            meta["tabular_section"] = ref.tabular_section
        if ref.ref_kind:
            meta["ref_kind"] = ref.ref_kind

        graph.add_edge(Edge(
            source=source_key,
            target=target_key,
            kind=kind,
            meta=meta,
        ))


def _build_movement_edges(graph: DependencyGraph, obj_info: ObjectInfo):
    """Создать рёбра Document → Register (движения)."""
    if obj_info.obj_type != "Document":
        return

    source_key = get_full_object_key("Document", obj_info.name)

    for reg_ref in obj_info.movement_registers:
        parts = reg_ref.split(".")
        if len(parts) >= 2:
            target_key = get_full_object_key(parts[0], parts[1])
        else:
            for reg_type in ("AccumulationRegister", "InformationRegister",
                             "AccountingRegister", "CalculationRegister"):
                target_key = get_full_object_key(reg_type, reg_ref)
                if target_key in graph.objects:
                    break

        if target_key in graph.objects:
            graph.add_edge(Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.DOC_TO_REGISTER,
                meta={"register": reg_ref},
            ))


def _build_subscription_edges(graph: DependencyGraph, obj_info: ObjectInfo):
    """Создать рёбра для подписок на события."""
    if obj_info.obj_type != "EventSubscription":
        return

    sub_key = get_full_object_key("EventSubscription", obj_info.name)

    for source_type in obj_info.source_types:
        parts = source_type.split(".")
        if len(parts) >= 2:
            target_key = get_full_object_key(parts[0], parts[1])
            if target_key in graph.objects:
                graph.add_edge(Edge(
                    source=sub_key,
                    target=target_key,
                    kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                    meta={"event": obj_info.event},
                ))

    if obj_info.handler:
        handler_parts = obj_info.handler.split(".")
        if len(handler_parts) >= 2:
            module_key = get_full_object_key("CommonModule", handler_parts[0])
            if module_key in graph.objects:
                graph.add_edge(Edge(
                    source=sub_key,
                    target=module_key,
                    kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                    meta={"handler": obj_info.handler},
                ))


def _build_bsl_edges(graph: DependencyGraph, obj_info: ObjectInfo):
    """Создать рёбра из BSL-анализа."""
    source_key = get_full_object_key(obj_info.obj_type, obj_info.name)

    for call in obj_info.bsl_calls:
        target_module = call.target_module

        if "." in target_module:
            target_key = target_module
        else:
            target_key = get_full_object_key("CommonModule", target_module)

        if target_key in graph.objects:
            graph.add_edge(Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.BSL_CALL,
                meta={
                    "method": call.target_method,
                    "source_module": call.source_module,
                    "line": str(call.source_line),
                },
            ))

    for qr in obj_info.bsl_query_refs:
        target_key = get_full_object_key(qr.obj_type, qr.obj_name)
        if target_key in graph.objects:
            graph.add_edge(Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={
                    "source_module": qr.source_module,
                    "line": str(qr.source_line),
                },
            ))


def _resolve_edge_kind(source_type: str, ref: ReferenceInfo) -> EdgeKind:
    """Определить тип ребра по типу источника и ссылки."""
    if ref.ref_kind == "owner":
        return EdgeKind.OWNER
    if ref.ref_kind == "based_on":
        return EdgeKind.BASED_ON

    target = ref.target_type

    register_types = {"InformationRegister", "AccumulationRegister",
                      "AccountingRegister", "CalculationRegister"}

    if source_type == "Document":
        if target in register_types:
            return EdgeKind.DOC_TO_REGISTER
        if target == "Catalog":
            return EdgeKind.DOC_TO_CATALOG
        if target == "Document":
            return EdgeKind.DOC_TO_DOCUMENT

    if source_type == "Catalog":
        if target == "Catalog":
            return EdgeKind.CATALOG_TO_CATALOG
        if target == "Document":
            return EdgeKind.CATALOG_TO_DOCUMENT

    if source_type in register_types:
        if target == "Document":
            return EdgeKind.REGISTER_TO_DOCUMENT
        if target == "Catalog":
            return EdgeKind.REGISTER_TO_CATALOG
        if target in register_types:
            return EdgeKind.REGISTER_TO_REGISTER

    if source_type == "Document" and target == "Catalog":
        return EdgeKind.DOC_TO_CATALOG

    return EdgeKind.BSL_META_ACCESS


def get_dependencies(
    graph: DependencyGraph,
    target: str,
    depth: int = 3,
    direction: str = "both",
) -> List[tuple]:
    """Получить зависимости объекта до указанной глубины.

    target: "Catalog.Номенклатура" или просто "Номенклатура"
    depth: глубина обхода
    direction: 'outgoing' | 'incoming' | 'both'
    Returns: list of (edge, level)
    """
    target_key = _resolve_target_key(graph, target)
    if not target_key:
        return []

    return graph.traverse(target_key, depth, direction)


def get_debug_points(
    graph: DependencyGraph,
    target: str,
    config_path: str = "",
) -> List[DebugPoint]:
    """Получить точки остановки для отладки объекта.

    Ищет процедуры проведения документов, обработчики подписок, модули объектов.
    """
    target_key = _resolve_target_key(graph, target)
    if not target_key:
        return []

    obj_info = graph.objects.get(target_key)
    if not obj_info:
        return []

    points: List[DebugPoint] = []

    for proc in obj_info.procedures:
        context = _get_procedure_context(proc.name, obj_info.obj_type)
        points.append(DebugPoint(
            procedure_name=proc.name,
            module_path=proc.module_path,
            line_number=proc.line_number,
            context=context,
            exists=True,
            source_object=obj_info.name,
            source_type=obj_info.obj_type,
        ))

    incoming = graph.get_edges_to(target_key, EdgeKind.SUBSCRIPTION_TO_OBJECT)
    for edge in incoming:
        sub_obj = graph.objects.get(edge.source)
        if sub_obj and sub_obj.handler:
            handler_parts = sub_obj.handler.split(".")
            handler_method = handler_parts[-1] if handler_parts else sub_obj.handler

            module_key = None
            if len(handler_parts) >= 2:
                module_key = get_full_object_key("CommonModule", handler_parts[0])

            module_obj = graph.objects.get(module_key) if module_key else None
            line = 0
            module_path = ""

            if module_obj:
                for proc in module_obj.procedures:
                    if proc.name == handler_method:
                        line = proc.line_number
                        module_path = proc.module_path
                        break

            points.append(DebugPoint(
                procedure_name=sub_obj.handler,
                module_path=module_path,
                line_number=line,
                context=f"Подписка: {sub_obj.name} ({sub_obj.event})",
                exists=line > 0,
                source_object=sub_obj.name,
                source_type="EventSubscription",
            ))

    if obj_info.obj_type == "Document":
        for reg_ref in obj_info.movement_registers:
            points.append(DebugPoint(
                procedure_name="ОбработкаПроведения",
                module_path="",
                line_number=0,
                context=f"Движения → {reg_ref}",
                exists=False,
                source_object=obj_info.name,
                source_type="Document",
            ))

    return points


def get_rights_for_object(
    graph: DependencyGraph,
    target: str,
) -> Dict[str, list]:
    """Получить права всех ролей на указанный объект.

    Returns: {"РольИмя": [RightInfo, ...], ...}
    """
    from models import RightInfo

    target_key = _resolve_target_key(graph, target)
    if not target_key:
        return {}

    result: Dict[str, list] = {}

    for role_name, role_info in graph.roles.items():
        role_rights = []
        for obj_rights in role_info.object_rights:
            if (obj_rights.object_name == target_key
                    or obj_rights.object_name.endswith(f".{target_key}")
                    or target_key.endswith(f".{obj_rights.object_name}")):
                role_rights.extend(obj_rights.rights)
        if role_rights:
            result[role_name] = role_rights

    return result


def _resolve_target_key(graph: DependencyGraph, target: str) -> Optional[str]:
    """Разрешить имя цели в полный ключ объекта."""
    if target in graph.objects:
        return target

    for key in graph.objects:
        if key.endswith(f".{target}"):
            return key

    target_lower = target.lower()
    for key in graph.objects:
        if key.lower() == target_lower or key.lower().endswith(f".{target_lower}"):
            return key

    return None
