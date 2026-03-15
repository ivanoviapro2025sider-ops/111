"""Catalog metadata parser."""

from __future__ import annotations

from typing import Dict

from models import ObjectInfo, ReferenceInfo
from scanner import (
    collect_references,
    dedupe_references,
    extract_attributes,
    extract_tabular_sections,
    get_xml_elements,
    get_xml_text,
    load_object_xml,
    parse_boolean,
)
from xml_helpers import parse_types_from_element


def parse_catalog(obj_info: ObjectInfo) -> ObjectInfo:
    """Parse a catalog object in place."""

    root = load_object_xml(obj_info)
    if root is None:
        return obj_info

    obj_info.attributes = extract_attributes(root)
    obj_info.tabular_sections = extract_tabular_sections(root)

    references = collect_references(obj_info.attributes)
    for section in obj_info.tabular_sections:
        references.extend(collect_references(section.attributes))

    hierarchical = parse_boolean(get_xml_text(root, ".//*[local-name()='Hierarchical']/text()", "false"))
    if hierarchical:
        references.append(
            ReferenceInfo(
                source_attribute="Parent",
                target_type="Catalog",
                target_name=obj_info.name,
                ref_kind="hierarchy",
            )
        )
        obj_info.properties["Hierarchical"] = "true"

    for owner_node in get_xml_elements(root, ".//*[local-name()='Owners']/*"):
        for owner_type in parse_types_from_element(owner_node):
            references.append(
                ReferenceInfo(
                    source_attribute="Owner",
                    target_type=owner_type["type"],
                    target_name=owner_type["name"],
                    ref_kind="owner",
                )
            )

    obj_info.references = dedupe_references(references)
    return obj_info


def parse_catalogs(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type == "Catalog":
            objects[key] = parse_catalog(obj_info)
    return objects
