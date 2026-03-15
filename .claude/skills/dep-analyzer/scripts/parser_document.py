"""Парсер документов 1С."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from scanner import extract_name, get_type_node, resolve_object_main_xml
from xml_helpers import get_xml_elements, parse_type_value, parse_types_from_element, parse_xml_file


def _extract_types(attribute_node) -> List[TypeRef]:
    containers = get_xml_elements(
        attribute_node,
        "./md:Type | ./md:Properties/md:Type | .//*[local-name()='Type' or local-name()='TypeSet']",
    )
    refs: List[TypeRef] = []
    seen = set()
    for container in containers:
        for item in parse_types_from_element(container):
            key = (item["type"], item["name"], item["full_type"])
            if key in seen:
                continue
            seen.add(key)
            refs.append(TypeRef(item["type"], item["name"], item["full_type"]))
    return refs


def _add_reference_edges(obj_info: ObjectInfo, attribute: AttributeInfo) -> None:
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


def _extract_register_targets(type_node) -> List[str]:
    registers: List[str] = []
    seen = set()
    candidate_nodes = get_xml_elements(
        type_node,
        ".//*[contains(local-name(), 'Register')]//*[local-name()='Item' or local-name()='Register' or local-name()='RegisterRecord']",
    )
    for node in candidate_nodes:
        parsed = parse_type_value(node)
        if parsed and parsed["type"] in {
            "InformationRegister",
            "AccumulationRegister",
            "AccountingRegister",
            "CalculationRegister",
        }:
            name = parsed["name"]
        else:
            name = extract_name(node, fallback=(getattr(node, "text", "") or "").strip())
        if not name or name in seen:
            continue
        seen.add(name)
        registers.append(name)
    return registers


def _extract_based_on_targets(type_node) -> List[str]:
    targets: List[str] = []
    seen = set()
    for node in get_xml_elements(type_node, ".//*[local-name()='BasedOn']//*[local-name()='Item']"):
        parsed = parse_type_value(node)
        if parsed and parsed["type"] == "Document":
            name = parsed["name"]
        else:
            name = extract_name(node, fallback=(getattr(node, "text", "") or "").strip())
        if not name or name in seen:
            continue
        seen.add(name)
        targets.append(name)
    return targets


def parse_document_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Заполнить структуру документа: реквизиты, ТЧ, движения, ввод на основании."""

    xml_path = resolve_object_main_xml(obj_info.path)
    xml_root = parse_xml_file(xml_path) if xml_path else None
    _obj_type, type_node = get_type_node(xml_root)
    if not type_node:
        return obj_info

    obj_info.attributes = []
    obj_info.tabular_sections = []
    obj_info.references = [ref for ref in obj_info.references if ref.ref_kind not in {"attribute", "based_on"}]

    for attribute_node in get_xml_elements(type_node, "./md:Attributes/md:Attribute"):
        attribute = AttributeInfo(
            name=extract_name(attribute_node),
            types=_extract_types(attribute_node),
        )
        if attribute.name:
            obj_info.attributes.append(attribute)
            _add_reference_edges(obj_info, attribute)

    for section_node in get_xml_elements(type_node, "./md:TabularSections/md:TabularSection"):
        section_name = extract_name(section_node)
        section = TabularSectionInfo(name=section_name)
        for attribute_node in get_xml_elements(section_node, "./md:Attributes/md:Attribute"):
            attribute = AttributeInfo(
                name=extract_name(attribute_node),
                types=_extract_types(attribute_node),
                tabular_section=section_name,
            )
            if attribute.name:
                section.attributes.append(attribute)
                _add_reference_edges(obj_info, attribute)
        obj_info.tabular_sections.append(section)

    obj_info.movement_registers = _extract_register_targets(type_node)
    obj_info.based_on = _extract_based_on_targets(type_node)
    for target_name in obj_info.based_on:
        obj_info.references.append(
            ReferenceInfo(
                source_attribute="BasedOn",
                target_type="Document",
                target_name=target_name,
                ref_kind="based_on",
            )
        )

    return obj_info


def parse_documents(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type == "Document":
            objects[key] = parse_document_object(obj_info)
    return objects
