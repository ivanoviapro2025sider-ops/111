"""Catalog metadata parser."""

from __future__ import annotations

from typing import List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import parse_types_from_element, parse_xml_file


def _first_text(element, name: str) -> str:
    values = element.xpath(f".//*[local-name()='{name}'][1]/text()")
    if not values:
        return ""
    return str(values[0]).strip()


def _leaf_properties(root) -> dict:
    result = {}
    for element in root.xpath(".//*[local-name()='Properties'][1]/*"):
        if len(element) == 0:
            key = element.tag.rsplit("}", 1)[-1]
            value = (element.text or "").strip()
            if value:
                result[key] = value
    return result


def _convert_types(type_dicts: List[dict]) -> List[TypeRef]:
    return [TypeRef(obj_type=item["type"], name=item["name"], full_type=item["full_type"]) for item in type_dicts]


def _attribute_from_element(element, tabular_section: str = "") -> AttributeInfo:
    name = _first_text(element, "Name")
    type_container = None
    found = element.xpath(".//*[local-name()='Type' or local-name()='TypeSet']")
    if found:
        type_container = found[0].getparent() if found[0].getparent() is not None else found[0]
    types = _convert_types(parse_types_from_element(type_container or element))
    return AttributeInfo(name=name, types=types, tabular_section=tabular_section)


def _append_references(obj: ObjectInfo, attribute: AttributeInfo) -> None:
    for type_ref in attribute.types:
        if type_ref.obj_type in {"Primitive", "Unknown"}:
            continue
        obj.references.append(
            ReferenceInfo(
                source_attribute=attribute.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attribute.tabular_section,
                ref_kind="attribute",
            )
        )


def parse_catalog(obj: ObjectInfo) -> ObjectInfo:
    xml_path = obj.properties.get("xml_path", "")
    root = parse_xml_file(xml_path)
    if root is None:
        return obj

    obj.synonym = _first_text(root, "Synonym") or obj.synonym
    obj.comment = _first_text(root, "Comment") or obj.comment
    obj.properties.update(_leaf_properties(root))

    for element in root.xpath(".//*[local-name()='ChildObjects'][1]/*[local-name()='Attribute' or local-name()='StandardAttribute']"):
        if element.xpath("ancestor::*[local-name()='TabularSection']"):
            continue
        attribute = _attribute_from_element(element)
        if attribute.name:
            obj.attributes.append(attribute)
            _append_references(obj, attribute)

    for tabular_section_element in root.xpath(".//*[local-name()='ChildObjects'][1]/*[local-name()='TabularSection']"):
        ts_name = _first_text(tabular_section_element, "Name")
        tabular_section = TabularSectionInfo(name=ts_name)
        for attribute_element in tabular_section_element.xpath(".//*[local-name()='Attribute' or local-name()='StandardAttribute']"):
            attribute = _attribute_from_element(attribute_element, tabular_section=ts_name)
            if attribute.name:
                tabular_section.attributes.append(attribute)
                _append_references(obj, attribute)
        obj.tabular_sections.append(tabular_section)

    for owner_element in root.xpath(".//*[local-name()='Owners']//*[local-name()='Type' or local-name()='TypeSet']"):
        for type_info in parse_types_from_element(owner_element):
            if type_info["type"] in {"Primitive", "Unknown"}:
                continue
            obj.references.append(
                ReferenceInfo(
                    source_attribute="Owner",
                    target_type=type_info["type"],
                    target_name=type_info["name"],
                    ref_kind="owner",
                )
            )

    hierarchical = obj.properties.get("Hierarchical", "").lower()
    if hierarchical in {"true", "1", "yes"}:
        obj.references.append(
            ReferenceInfo(
                source_attribute="Parent",
                target_type=obj.obj_type,
                target_name=obj.name,
                ref_kind="hierarchy",
            )
        )

    return obj


def parse_catalogs(objects: List[ObjectInfo]) -> List[ObjectInfo]:
    for obj in objects:
        parse_catalog(obj)
    return objects
