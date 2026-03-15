"""Парсер прочих объектов: подписки, общие модули, перечисления, обработки,
отчёты, бизнес-процессы, задачи, планы обмена, константы."""
import os
from typing import List

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements, parse_types_from_element,
    get_full_object_key, _detect_nsmap, NSMAP,
)

_MISC_TYPES = {
    "Enum", "ChartOfCharacteristicTypes", "ChartOfAccounts",
    "ChartOfCalculationTypes", "BusinessProcess", "Task",
    "ExchangePlan", "Report", "DataProcessor", "Constant",
}


def parse_misc_objects(graph: DependencyGraph, config_path: str):
    """Разобрать все прочие объекты (перечисления, ПВХ, отчёты и т.д.)."""
    for key, obj in list(graph.objects.items()):
        if obj.obj_type in _MISC_TYPES:
            _parse_misc_object(obj, graph, config_path)
        elif obj.obj_type == "CommonModule":
            _parse_common_module(obj, graph, config_path)
        elif obj.obj_type == "EventSubscription":
            _parse_event_subscription(obj, graph, config_path)


def _parse_misc_object(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    xml_path = os.path.join(obj.path, f"{obj.name}.xml") if obj.path else None
    if not xml_path or not os.path.exists(xml_path):
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    el = _find_element_by_type(root, obj.obj_type, nsmap)
    if el is None:
        return

    _parse_base_properties(el, obj, nsmap)
    _parse_generic_attributes(el, obj, graph, nsmap)
    _parse_generic_tabular_sections(el, obj, graph, nsmap)
    _parse_forms_templates(el, obj, nsmap)


def _parse_common_module(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Парсинг общего модуля — извлечь флаги Global, Server, Client, External."""
    xml_path = os.path.join(obj.path, f"{obj.name}.xml") if obj.path else None
    if not xml_path or not os.path.exists(xml_path):
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    el = _find_element_by_type(root, "CommonModule", nsmap)
    if el is None:
        el = root

    _parse_base_properties(el, obj, nsmap)

    obj.is_global = get_xml_text(el, ".//md:Properties/md:Global", "false", nsmap).lower() == "true"
    obj.is_server = get_xml_text(el, ".//md:Properties/md:Server", "false", nsmap).lower() == "true"
    obj.is_client = (
        get_xml_text(el, ".//md:Properties/md:ClientManagedApplication", "false", nsmap).lower() == "true"
        or get_xml_text(el, ".//md:Properties/md:ClientOrdinaryApplication", "false", nsmap).lower() == "true"
    )
    obj.is_external = get_xml_text(el, ".//md:Properties/md:ExternalConnection", "false", nsmap).lower() == "true"


def _parse_event_subscription(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Парсинг подписки на событие: обработчик, источники, событие."""
    xml_path = os.path.join(obj.path, f"{obj.name}.xml") if obj.path else None
    if not xml_path or not os.path.exists(xml_path):
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    el = _find_element_by_type(root, "EventSubscription", nsmap)
    if el is None:
        el = root

    _parse_base_properties(el, obj, nsmap)

    obj.handler = get_xml_text(el, ".//md:Properties/md:Handler", "", nsmap)
    obj.event = get_xml_text(el, ".//md:Properties/md:Event", "", nsmap)

    for src_el in get_xml_elements(el, ".//md:Properties/md:Source/xr:Item", nsmap):
        text = src_el.text
        if text and text.strip():
            obj.source_types.append(text.strip())

    if not obj.source_types:
        src_text = get_xml_text(el, ".//md:Properties/md:Source", "", nsmap)
        if src_text:
            obj.source_types.append(src_text)

    sub_key = get_full_object_key(obj.obj_type, obj.name)

    for src_type in obj.source_types:
        parts = src_type.split(".")
        if len(parts) >= 2:
            graph.add_edge(Edge(
                source=sub_key,
                target=get_full_object_key(parts[0], parts[1]),
                kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                meta={"event": obj.event},
            ))

    if obj.handler:
        parts = obj.handler.split(".")
        if len(parts) >= 2:
            module_name = parts[0]
            graph.add_edge(Edge(
                source=sub_key,
                target=get_full_object_key("CommonModule", module_name),
                kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                meta={"handler": obj.handler},
            ))


def _find_element_by_type(root, obj_type: str, nsmap: dict):
    els = get_xml_elements(root, f".//md:{obj_type}", nsmap)
    if els:
        return els[0]
    for child in root:
        local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if local == obj_type:
            return child
    return root


def _parse_base_properties(el, obj: ObjectInfo, nsmap: dict):
    obj.synonym = get_xml_text(el, ".//md:Properties/md:Synonym/v8:item/v8:content", "", nsmap)
    if not obj.synonym:
        obj.synonym = get_xml_text(el, ".//md:Properties/md:Synonym", "", nsmap)
    obj.comment = get_xml_text(el, ".//md:Properties/md:Comment", "", nsmap)

    for prop_el in get_xml_elements(el, ".//md:Properties/*", nsmap):
        tag = prop_el.tag.split("}")[-1] if "}" in prop_el.tag else prop_el.tag
        val = prop_el.text
        if val and val.strip():
            obj.properties[tag] = val.strip()


def _parse_generic_attributes(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    for attr_el in get_xml_elements(el, ".//md:ChildObjects/md:Attribute", nsmap):
        attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", "", nsmap)
        if not attr_name:
            attr_name = attr_el.get("name", "")
        if not attr_name:
            continue

        attr_info = AttributeInfo(name=attr_name)
        type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
        if type_container:
            type_refs = parse_types_from_element(type_container[0])
            for tr in type_refs:
                attr_info.types.append(TypeRef(
                    obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                ))
                _add_generic_edge(obj, attr_name, tr, graph)

        obj.attributes.append(attr_info)


def _parse_generic_tabular_sections(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    for ts_el in get_xml_elements(el, ".//md:ChildObjects/md:TabularSection", nsmap):
        ts_name = get_xml_text(ts_el, ".//md:Properties/md:Name", "", nsmap)
        if not ts_name:
            ts_name = ts_el.get("name", "")
        if not ts_name:
            continue

        ts_info = TabularSectionInfo(name=ts_name)

        for attr_el in get_xml_elements(ts_el, ".//md:ChildObjects/md:Attribute", nsmap):
            attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", "", nsmap)
            if not attr_name:
                attr_name = attr_el.get("name", "")
            if not attr_name:
                continue

            attr_info = AttributeInfo(name=attr_name, tabular_section=ts_name)
            type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
            if type_container:
                type_refs = parse_types_from_element(type_container[0])
                for tr in type_refs:
                    attr_info.types.append(TypeRef(
                        obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                    ))

            ts_info.attributes.append(attr_info)

        obj.tabular_sections.append(ts_info)


def _parse_forms_templates(el, obj: ObjectInfo, nsmap: dict):
    for form_el in get_xml_elements(el, ".//md:ChildObjects/md:Form", nsmap):
        name = form_el.text.strip() if form_el.text else ""
        if name:
            obj.forms.append(name)
    for tmpl_el in get_xml_elements(el, ".//md:ChildObjects/md:Template", nsmap):
        name = tmpl_el.text.strip() if tmpl_el.text else ""
        if name:
            obj.templates.append(name)


def _add_generic_edge(obj: ObjectInfo, attr_name: str, type_ref: dict,
                      graph: DependencyGraph):
    target_type = type_ref["type"]
    target_name = type_ref["name"]
    if target_type in ("DefinedType",):
        return

    ref = ReferenceInfo(
        source_attribute=attr_name,
        target_type=target_type,
        target_name=target_name,
        ref_kind="attribute",
    )
    obj.references.append(ref)
