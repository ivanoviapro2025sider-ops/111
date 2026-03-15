"""Построение графа зависимостей + рекурсивный обход по Depth."""

from typing import Dict, List, Optional, Set, Tuple

from models import (
    ObjectInfo, DependencyGraph, Edge, EdgeKind,
    ReferenceInfo, BSLCall, BSLQueryRef,
)
from xml_helpers import get_full_object_key


def build_graph(objects: Dict[str, ObjectInfo]) -> DependencyGraph:
    """Построить полный граф зависимостей из индекса объектов."""
    graph = DependencyGraph()

    for key, obj in objects.items():
        graph.add_object(obj)

    for key, obj in objects.items():
        source_key = get_full_object_key(obj.obj_type, obj.name)

        _add_reference_edges(graph, obj, source_key)
        _add_movement_edges(graph, obj, source_key, objects)
        _add_based_on_edges(graph, obj, source_key)
        _add_subscription_edges(graph, obj, source_key, objects)
        _add_bsl_call_edges(graph, obj, source_key, objects)
        _add_bsl_query_ref_edges(graph, obj, source_key)

    for key, obj in objects.items():
        if obj.obj_type == "Role" and obj.role_info:
            graph.add_role(obj.role_info)

    return graph


def get_subgraph(graph: DependencyGraph, target: str, depth: int,
                 direction: str = "both") -> DependencyGraph:
    """Извлечь подграф вокруг target с указанной глубиной."""
    subgraph = DependencyGraph()

    target_obj = graph.objects.get(target)
    if target_obj:
        subgraph.add_object(target_obj)

    traversed = graph.traverse(target, depth, direction)

    for edge, level in traversed:
        if edge.source in graph.objects and edge.source not in subgraph.objects:
            subgraph.add_object(graph.objects[edge.source])
        if edge.target in graph.objects and edge.target not in subgraph.objects:
            subgraph.add_object(graph.objects[edge.target])
        subgraph.add_edge(edge)

    for role_name, role_info in graph.roles.items():
        for obj_rights in role_info.object_rights:
            if obj_rights.object_name in subgraph.objects:
                subgraph.add_role(role_info)
                break

    return subgraph


def find_target_key(graph: DependencyGraph, target: str) -> Optional[str]:
    """Найти ключ объекта по частичному имени.
    Поддерживает: "Document.Реализация", "Реализация", "РеализацияТоваровУслуг"."""
    if target in graph.objects:
        return target

    for key in graph.objects:
        if key.lower() == target.lower():
            return key

    for key in graph.objects:
        obj = graph.objects[key]
        if obj.name == target or obj.name.lower() == target.lower():
            return key

    for key in graph.objects:
        obj = graph.objects[key]
        if target.lower() in obj.name.lower() or target.lower() in key.lower():
            return key

    return None


def get_dependency_chain(graph: DependencyGraph, target: str,
                         depth: int) -> List[Tuple[str, List[Edge], int]]:
    """Получить цепочки зависимостей для target.
    Returns: list of (node_key, edges_to_node, level)."""
    result: List[Tuple[str, List[Edge], int]] = []
    visited: Set[str] = set()
    queue: List[Tuple[str, int]] = [(target, 0)]

    while queue:
        current, level = queue.pop(0)
        if level > depth or current in visited:
            continue
        visited.add(current)

        edges_out = graph.get_edges_from(current)
        edges_in = graph.get_edges_to(current)

        result.append((current, edges_out + edges_in, level))

        for edge in edges_out:
            if edge.target not in visited:
                queue.append((edge.target, level + 1))
        for edge in edges_in:
            if edge.source not in visited:
                queue.append((edge.source, level + 1))

    return result


def _add_reference_edges(graph: DependencyGraph, obj: ObjectInfo, source_key: str):
    """Добавить рёбра по ссылкам из реквизитов."""
    for ref in obj.references:
        target_key = get_full_object_key(ref.target_type, ref.target_name)

        edge_kind = _determine_ref_edge_kind(obj.obj_type, ref)
        meta = {"attribute": ref.source_attribute}
        if ref.tabular_section:
            meta["tabular_section"] = ref.tabular_section
        if ref.ref_kind:
            meta["ref_kind"] = ref.ref_kind

        graph.add_edge(Edge(
            source=source_key,
            target=target_key,
            kind=edge_kind,
            meta=meta,
        ))


def _determine_ref_edge_kind(source_type: str, ref: ReferenceInfo) -> EdgeKind:
    """Определить тип ребра на основе типов объектов и вида ссылки."""
    if ref.ref_kind == "owner":
        return EdgeKind.OWNER
    if ref.ref_kind == "hierarchy":
        return EdgeKind.HIERARCHY

    kind_map = {
        ("Document", "Catalog"): EdgeKind.DOC_TO_CATALOG,
        ("Document", "Document"): EdgeKind.DOC_TO_DOCUMENT,
        ("Catalog", "Catalog"): EdgeKind.CATALOG_TO_CATALOG,
        ("Catalog", "Document"): EdgeKind.CATALOG_TO_DOCUMENT,
        ("InformationRegister", "Catalog"): EdgeKind.REGISTER_TO_CATALOG,
        ("InformationRegister", "Document"): EdgeKind.REGISTER_TO_DOCUMENT,
        ("InformationRegister", "InformationRegister"): EdgeKind.REGISTER_TO_REGISTER,
        ("AccumulationRegister", "Catalog"): EdgeKind.REGISTER_TO_CATALOG,
        ("AccumulationRegister", "Document"): EdgeKind.REGISTER_TO_DOCUMENT,
        ("AccumulationRegister", "AccumulationRegister"): EdgeKind.REGISTER_TO_REGISTER,
        ("AccountingRegister", "Catalog"): EdgeKind.REGISTER_TO_CATALOG,
        ("AccountingRegister", "Document"): EdgeKind.REGISTER_TO_DOCUMENT,
        ("CalculationRegister", "Catalog"): EdgeKind.REGISTER_TO_CATALOG,
        ("CalculationRegister", "Document"): EdgeKind.REGISTER_TO_DOCUMENT,
    }

    key = (source_type, ref.target_type)
    return kind_map.get(key, EdgeKind.BSL_META_ACCESS)


def _add_movement_edges(graph: DependencyGraph, obj: ObjectInfo,
                        source_key: str, objects: Dict[str, ObjectInfo]):
    """Добавить рёбра движений документа."""
    if obj.obj_type != "Document":
        return

    for reg_name in obj.movement_registers:
        if "." in reg_name:
            target_key = reg_name
        else:
            target_key = None
            for reg_type in ("AccumulationRegister", "InformationRegister",
                             "AccountingRegister", "CalculationRegister"):
                candidate = get_full_object_key(reg_type, reg_name)
                if candidate in objects:
                    target_key = candidate
                    break
            if not target_key:
                target_key = reg_name

        graph.add_edge(Edge(
            source=source_key,
            target=target_key,
            kind=EdgeKind.DOC_TO_REGISTER,
            meta={"movement": "true"},
        ))


def _add_based_on_edges(graph: DependencyGraph, obj: ObjectInfo, source_key: str):
    """Добавить рёбра ввода на основании."""
    if obj.obj_type != "Document":
        return

    for based_on_ref in obj.based_on:
        target_key = based_on_ref
        if "Ref." in target_key:
            parts = target_key.replace("cfg:", "").split(".")
            if len(parts) >= 2:
                type_part = parts[0].replace("Ref", "")
                name_part = parts[-1]
                target_key = get_full_object_key(type_part, name_part)

        graph.add_edge(Edge(
            source=source_key,
            target=target_key,
            kind=EdgeKind.BASED_ON,
            meta={"based_on": "true"},
        ))


def _add_subscription_edges(graph: DependencyGraph, obj: ObjectInfo,
                            source_key: str, objects: Dict[str, ObjectInfo]):
    """Добавить рёбра подписок на события."""
    if obj.obj_type != "EventSubscription":
        return

    for source_type_text in obj.source_types:
        target_key = _resolve_subscription_source(source_type_text, objects)
        if target_key:
            graph.add_edge(Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                meta={"event": obj.event},
            ))

    if obj.handler:
        parts = obj.handler.split(".")
        if len(parts) >= 1:
            module_name = parts[0]
            module_key = get_full_object_key("CommonModule", module_name)
            graph.add_edge(Edge(
                source=source_key,
                target=module_key,
                kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                meta={"handler": obj.handler},
            ))


def _resolve_subscription_source(source_text: str, objects: Dict[str, ObjectInfo]) -> Optional[str]:
    """Разрешить текст источника подписки в ключ объекта."""
    import re
    patterns = [
        (r"CatalogObject\.(\w+)", "Catalog"),
        (r"DocumentObject\.(\w+)", "Document"),
        (r"InformationRegisterRecordSet\.(\w+)", "InformationRegister"),
        (r"AccumulationRegisterRecordSet\.(\w+)", "AccumulationRegister"),
        (r"AccountingRegisterRecordSet\.(\w+)", "AccountingRegister"),
        (r"CalculationRegisterRecordSet\.(\w+)", "CalculationRegister"),
        (r"BusinessProcessObject\.(\w+)", "BusinessProcess"),
        (r"TaskObject\.(\w+)", "Task"),
        (r"ExchangePlanObject\.(\w+)", "ExchangePlan"),
        (r"ChartOfCharacteristicTypesObject\.(\w+)", "ChartOfCharacteristicTypes"),
        (r"ChartOfAccountsObject\.(\w+)", "ChartOfAccounts"),
    ]
    for pat, obj_type in patterns:
        m = re.search(pat, source_text)
        if m:
            return get_full_object_key(obj_type, m.group(1))
    return None


def _add_bsl_call_edges(graph: DependencyGraph, obj: ObjectInfo,
                        source_key: str, objects: Dict[str, ObjectInfo]):
    """Добавить рёбра вызовов из BSL-кода."""
    for call in obj.bsl_calls:
        target = call.target_module
        if "." in target and target in objects:
            graph.add_edge(Edge(
                source=source_key,
                target=target,
                kind=EdgeKind.BSL_META_ACCESS,
                meta={"method": call.target_method, "line": str(call.source_line)},
            ))
        else:
            module_key = get_full_object_key("CommonModule", target)
            if module_key in objects:
                graph.add_edge(Edge(
                    source=source_key,
                    target=module_key,
                    kind=EdgeKind.BSL_CALL,
                    meta={"method": call.target_method, "line": str(call.source_line)},
                ))


def _add_bsl_query_ref_edges(graph: DependencyGraph, obj: ObjectInfo, source_key: str):
    """Добавить рёбра ссылок из текстов запросов."""
    for qref in obj.bsl_query_refs:
        target_key = get_full_object_key(qref.obj_type, qref.obj_name)
        graph.add_edge(Edge(
            source=source_key,
            target=target_key,
            kind=EdgeKind.BSL_QUERY_REF,
            meta={"line": str(qref.source_line)},
        ))
