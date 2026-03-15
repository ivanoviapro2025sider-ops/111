"""Parser for 1C Catalog metadata objects."""

from __future__ import annotations

import os
from typing import List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_type_value, parse_types_from_element, parse_xml_file


def _extract_object_name(file_path: str) -> str:
    base = os.path.basename(file_path)
    if base.lower() == "object.xml":
        return os.path.basename(os.path.dirname(file_path))
    return os.path.splitext(base)[0]


def _build_attribute(attribute_node, tabular_section: str = "") -> AttributeInfo:
    name = (
        get_xml_text(attribute_node, ".//*[local-name()='Name']")
        or get_xml_text(attribute_node, "./@name")
        or "UnknownAttribute"
    )
    type_container = get_xml_elements(attribute_node, ".//*[local-name()='Type']")
    parsed_types = []
    for container in type_container:
        parsed_types.extend(parse_types_from_element(container))
    if not parsed_types:
        single = parse_type_value(attribute_node)
        if single:
            parsed_types.append(single)

    types = [TypeRef(obj_type=item["type"], name=item["name"], full_type=item["full_type"]) for item in parsed_types]
    return AttributeInfo(name=name, types=types, tabular_section=tabular_section)


def parse_catalog(catalog_xml_path: str) -> ObjectInfo:
    """Parse catalog metadata XML file into ObjectInfo."""
    root = parse_xml_file(catalog_xml_path)
    name = _extract_object_name(catalog_xml_path)
    obj = ObjectInfo(name=name, obj_type="Catalog", path=os.path.dirname(catalog_xml_path))
    if root is None:
        return obj

    obj.synonym = (
        get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item'][1]")
        or get_xml_text(root, ".//*[local-name()='Synonym']")
    )
    obj.comment = get_xml_text(root, ".//*[local-name()='Comment']")
    obj.forms = [get_xml_text(node, ".//*[local-name()='Name']") for node in get_xml_elements(root, ".//*[local-name()='Form']")]
    obj.templates = [
        get_xml_text(node, ".//*[local-name()='Name']") for node in get_xml_elements(root, ".//*[local-name()='Template']")
    ]
    obj.commands = [get_xml_text(node, ".//*[local-name()='Name']") for node in get_xml_elements(root, ".//*[local-name()='Command']")]

    # Top-level attributes.
    attr_nodes = get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']")
    for attr_node in attr_nodes:
        attribute = _build_attribute(attr_node)
        obj.attributes.append(attribute)
        for typeref in attribute.types:
            if typeref.obj_type not in {"Primitive", "Unknown", "DefinedType"}:
                obj.references.append(
                    ReferenceInfo(
                        source_attribute=attribute.name,
                        target_type=typeref.obj_type,
                        target_name=typeref.name,
                        ref_kind="attribute",
                    )
                )

    # Tabular sections.
    section_nodes = get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']")
    for section_node in section_nodes:
        section_name = get_xml_text(section_node, ".//*[local-name()='Name']") or "UnknownSection"
        ts = TabularSectionInfo(name=section_name)
        section_attr_nodes = get_xml_elements(section_node, ".//*[local-name()='Attribute']")
        for section_attr in section_attr_nodes:
            attribute = _build_attribute(section_attr, tabular_section=section_name)
            ts.attributes.append(attribute)
            for typeref in attribute.types:
                if typeref.obj_type not in {"Primitive", "Unknown", "DefinedType"}:
                    obj.references.append(
                        ReferenceInfo(
                            source_attribute=attribute.name,
                            target_type=typeref.obj_type,
                            target_name=typeref.name,
                            tabular_section=section_name,
                            ref_kind="attribute",
                        )
                    )
        obj.tabular_sections.append(ts)

    # Owner references.
    owner_type_nodes = get_xml_elements(root, ".//*[local-name()='Owner']//*[local-name()='Type']")
    for owner_type_node in owner_type_nodes:
        for owner_type in parse_types_from_element(owner_type_node):
            if owner_type["type"] in {"Catalog", "Document"}:
                obj.references.append(
                    ReferenceInfo(
                        source_attribute="Owner",
                        target_type=owner_type["type"],
                        target_name=owner_type["name"],
                        ref_kind="owner",
                    )
                )

    # Hierarchical catalogs always reference themselves by Parent.
    is_hierarchical = get_xml_text(root, ".//*[local-name()='Hierarchical']").lower() in {"true", "истина", "1"}
    if is_hierarchical:
        obj.references.append(
            ReferenceInfo(
                source_attribute="Parent",
                target_type="Catalog",
                target_name=obj.name,
                ref_kind="hierarchy",
            )
        )

    return obj


def parse_catalog_files(catalog_xml_paths: List[str]) -> List[ObjectInfo]:
    return [parse_catalog(path) for path in catalog_xml_paths]
