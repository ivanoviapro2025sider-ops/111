"""Парсер прочих объектов метаданных 1С."""

from __future__ import annotations

from typing import Dict, List, Set

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from scanner import extract_name, get_type_node, resolve_object_main_xml
from xml_helpers import get_xml_elements, get_xml_text, parse_type_value, parse_types_from_element, parse_xml_file

GENERIC_TYPES: Set[str] = {
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "Report",
    "DataProcessor",
    "CommonModule",
    "EventSubscription",
    "Constant",
    "DocumentJournal",
    "ScheduledJob",
    "DefinedType",
    "HTTPService",
    "WebService",
}


def _extract_type_refs(node) -> List[TypeRef]:
    containers = get_xml_elements(
        node,
        "./md:Type | ./md:Properties/md:Type | .//*[local-name()='Type' or local-name()='TypeSet']",
    )
    result: List[TypeRef] = []
    seen = set()
    for container in containers:
        for item in parse_types_from_element(container):
            key = (item["type"], item["name"], item["full_type"])
            if key in seen:
                continue
            seen.add(key)
            result.append(TypeRef(item["type"], item["name"], item["full_type"]))
    return result


def _append_references(obj_info: ObjectInfo, attribute: AttributeInfo) -> None:
    for type_ref in attribute.types:
        if type_ref.obj_type in {"Primitive", "DefinedType", "Unknown", "TypeSet"}:
            continue
        obj_info.references.append(
            ReferenceInfo(
                source_attribute=attribute.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attribute.tabular_section,
                ref_kind="attribute",
            )
        )


def parse_misc_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Универсальный парсер для остальных объектов, где нужны реквизиты и служебные ссылки."""

    xml_path = resolve_object_main_xml(obj_info.path)
    xml_root = parse_xml_file(xml_path) if xml_path else None
    _obj_type, type_node = get_type_node(xml_root)
    if not type_node:
        return obj_info

    obj_info.references = [ref for ref in obj_info.references if ref.ref_kind != "attribute"]

    attributes: List[AttributeInfo] = []
    for attribute_node in get_xml_elements(type_node, "./md:Attributes/md:Attribute"):
        attribute = AttributeInfo(
            name=extract_name(attribute_node),
            types=_extract_type_refs(attribute_node),
        )
        if attribute.name:
            attributes.append(attribute)
            _append_references(obj_info, attribute)

    tabular_sections: List[TabularSectionInfo] = []
    for section_node in get_xml_elements(type_node, "./md:TabularSections/md:TabularSection"):
        section_name = extract_name(section_node)
        section = TabularSectionInfo(name=section_name)
        for attribute_node in get_xml_elements(section_node, "./md:Attributes/md:Attribute"):
            attribute = AttributeInfo(
                name=extract_name(attribute_node),
                types=_extract_type_refs(attribute_node),
                tabular_section=section_name,
            )
            if attribute.name:
                section.attributes.append(attribute)
                _append_references(obj_info, attribute)
        tabular_sections.append(section)

    if attributes:
        obj_info.attributes = attributes
    if tabular_sections:
        obj_info.tabular_sections = tabular_sections

    if obj_info.obj_type == "EventSubscription":
        if not obj_info.handler:
            obj_info.handler = get_xml_text(type_node, ".//*[local-name()='Handler']")
        if not obj_info.event:
            obj_info.event = get_xml_text(type_node, ".//*[local-name()='Event']")
        if not obj_info.source_types:
            obj_info.source_types = [
                (getattr(item, "text", "") or "").strip()
                for item in get_xml_elements(type_node, ".//*[local-name()='Source']//*[local-name()='Item']")
                if (getattr(item, "text", "") or "").strip()
            ]

    if obj_info.obj_type == "ScheduledJob":
        main_method = get_xml_text(type_node, ".//*[local-name()='MethodName']")
        if main_method:
            obj_info.properties["MethodName"] = main_method

    if obj_info.obj_type == "DefinedType":
        parsed_types: List[str] = []
        for type_node_item in get_xml_elements(type_node, ".//*[local-name()='Type' or local-name()='TypeSet']"):
            parsed = parse_type_value(type_node_item)
            if parsed:
                parsed_types.append(parsed["full_type"])
        if parsed_types:
            obj_info.properties["TypeSet"] = ", ".join(sorted(set(parsed_types)))

    return obj_info


def parse_misc_objects(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type in GENERIC_TYPES:
            objects[key] = parse_misc_object(obj_info)
    return objects
