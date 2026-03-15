"""Парсер регистров 1С: сведений, накопления, бухгалтерии, расчёта."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from scanner import extract_name, get_type_node, resolve_object_main_xml
from xml_helpers import get_xml_elements, parse_type_value, parse_types_from_element, parse_xml_file

REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
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


def _append_references(obj_info: ObjectInfo, attribute: AttributeInfo, ref_kind: str) -> None:
    for type_ref in attribute.types:
        if type_ref.obj_type in {"Primitive", "DefinedType", "Unknown", "TypeSet"}:
            continue
        obj_info.references.append(
            ReferenceInfo(
                source_attribute=attribute.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attribute.tabular_section,
                ref_kind=ref_kind,
            )
        )


def _collect_register_part(type_node, xpath: str, is_dimension: bool = False, is_resource: bool = False) -> List[AttributeInfo]:
    result: List[AttributeInfo] = []
    for node in get_xml_elements(type_node, xpath):
        attribute = AttributeInfo(
            name=extract_name(node),
            types=_extract_type_refs(node),
            is_dimension=is_dimension,
            is_resource=is_resource,
        )
        if attribute.name:
            result.append(attribute)
    return result


def _extract_recorders(type_node) -> List[ReferenceInfo]:
    result: List[ReferenceInfo] = []
    for node in get_xml_elements(type_node, ".//*[local-name()='Recorders']//*[local-name()='Item']"):
        parsed = parse_type_value(node)
        if not parsed or parsed["type"] != "Document":
            continue
        result.append(
            ReferenceInfo(
                source_attribute="Recorder",
                target_type="Document",
                target_name=parsed["name"],
                ref_kind="recorder",
            )
        )
    return result


def parse_register_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Заполнить структуру регистра: измерения, ресурсы, реквизиты, регистраторы."""

    xml_path = resolve_object_main_xml(obj_info.path)
    xml_root = parse_xml_file(xml_path) if xml_path else None
    _obj_type, type_node = get_type_node(xml_root)
    if not type_node:
        return obj_info

    obj_info.attributes = []
    obj_info.references = [ref for ref in obj_info.references if ref.ref_kind not in {"dimension", "resource", "attribute", "recorder"}]

    dimensions = _collect_register_part(type_node, ".//*[local-name()='Dimensions']/*", is_dimension=True)
    resources = _collect_register_part(type_node, ".//*[local-name()='Resources']/*", is_resource=True)
    attributes = _collect_register_part(type_node, "./md:Attributes/md:Attribute")

    obj_info.attributes.extend(dimensions)
    obj_info.attributes.extend(resources)
    obj_info.attributes.extend(attributes)

    for attribute in dimensions:
        _append_references(obj_info, attribute, "dimension")
    for attribute in resources:
        _append_references(obj_info, attribute, "resource")
    for attribute in attributes:
        _append_references(obj_info, attribute, "attribute")

    obj_info.references.extend(_extract_recorders(type_node))
    return obj_info


def parse_registers(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type in REGISTER_TYPES:
            objects[key] = parse_register_object(obj_info)
    return objects
