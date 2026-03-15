"""Парсер справочников 1С."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from scanner import extract_name, get_type_node, resolve_object_main_xml
from xml_helpers import get_xml_elements, get_xml_text, parse_type_value, parse_types_from_element, parse_xml_file


def _type_refs_from_container(container) -> List[TypeRef]:
    refs: List[TypeRef] = []
    for item in parse_types_from_element(container):
        refs.append(
            TypeRef(
                obj_type=item["type"],
                name=item["name"],
                full_type=item["full_type"],
            )
        )
    return refs


def _extract_attribute_types(attribute_node) -> List[TypeRef]:
    containers = get_xml_elements(
        attribute_node,
        "./md:Type | ./md:Properties/md:Type | .//*[local-name()='Type' or local-name()='TypeSet']",
    )
    refs: List[TypeRef] = []
    seen = set()
    for container in containers:
        for item in _type_refs_from_container(container):
            key = (item.obj_type, item.name, item.full_type)
            if key in seen:
                continue
            seen.add(key)
            refs.append(item)
    return refs


def _append_attribute_references(obj_info: ObjectInfo, attribute: AttributeInfo) -> None:
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


def parse_catalog_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Заполнить структуру справочника: реквизиты, ТЧ, владельцы, иерархия."""

    xml_path = resolve_object_main_xml(obj_info.path)
    xml_root = parse_xml_file(xml_path) if xml_path else None
    _obj_type, type_node = get_type_node(xml_root)
    if not type_node:
        return obj_info

    obj_info.attributes = []
    obj_info.tabular_sections = []
    obj_info.references = [ref for ref in obj_info.references if ref.ref_kind not in {"attribute", "owner", "hierarchy"}]

    for attribute_node in get_xml_elements(type_node, "./md:Attributes/md:Attribute"):
        attribute = AttributeInfo(
            name=extract_name(attribute_node),
            types=_extract_attribute_types(attribute_node),
        )
        if attribute.name:
            obj_info.attributes.append(attribute)
            _append_attribute_references(obj_info, attribute)

    for section_node in get_xml_elements(type_node, "./md:TabularSections/md:TabularSection"):
        section_name = extract_name(section_node)
        section = TabularSectionInfo(name=section_name)
        for attribute_node in get_xml_elements(section_node, "./md:Attributes/md:Attribute"):
            attribute = AttributeInfo(
                name=extract_name(attribute_node),
                types=_extract_attribute_types(attribute_node),
                tabular_section=section_name,
            )
            if attribute.name:
                section.attributes.append(attribute)
                _append_attribute_references(obj_info, attribute)
        obj_info.tabular_sections.append(section)

    hierarchy_type = get_xml_text(type_node, ".//*[local-name()='HierarchyType']")
    if hierarchy_type and hierarchy_type.lower() not in {"none", "withouthierarchy"}:
        obj_info.references.append(
            ReferenceInfo(
                source_attribute="Parent",
                target_type="Catalog",
                target_name=obj_info.name,
                ref_kind="hierarchy",
            )
        )

    for owner_node in get_xml_elements(type_node, ".//*[local-name()='Owners']//*[local-name()='Item']"):
        parsed = parse_type_value(owner_node)
        if not parsed or parsed["type"] in {"Primitive", "Unknown", "DefinedType", "TypeSet"}:
            continue
        obj_info.references.append(
            ReferenceInfo(
                source_attribute="Owner",
                target_type=parsed["type"],
                target_name=parsed["name"],
                ref_kind="owner",
            )
        )

    return obj_info


def parse_catalogs(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type == "Catalog":
            objects[key] = parse_catalog_object(obj_info)
    return objects
