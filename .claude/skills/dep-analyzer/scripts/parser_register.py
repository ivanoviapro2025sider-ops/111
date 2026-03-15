"""Register metadata parser."""

from __future__ import annotations

from typing import Dict

from models import ObjectInfo, ReferenceInfo
from scanner import (
    collect_references,
    dedupe_references,
    extract_attributes,
    extract_dimensions,
    extract_resources,
    get_xml_elements,
    load_object_xml,
)
from xml_helpers import parse_types_from_element


REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def parse_register(obj_info: ObjectInfo) -> ObjectInfo:
    """Parse a register object in place."""

    root = load_object_xml(obj_info)
    if root is None:
        return obj_info

    dimensions = extract_dimensions(root)
    resources = extract_resources(root)
    attributes = extract_attributes(root)

    obj_info.attributes = dimensions + resources + attributes
    obj_info.references = dedupe_references(collect_references(obj_info.attributes))

    for recorder_node in get_xml_elements(root, ".//*[local-name()='Recorder']//*[local-name()='Type' or local-name()='TypeSet']"):
        for item in parse_types_from_element(recorder_node):
            if item["type"] == "Document":
                obj_info.references.append(
                    ReferenceInfo(
                        source_attribute="Recorder",
                        target_type=item["type"],
                        target_name=item["name"],
                        ref_kind="recorder",
                    )
                )

    obj_info.references = dedupe_references(obj_info.references)
    return obj_info


def parse_registers(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type in REGISTER_TYPES:
            objects[key] = parse_register(obj_info)
    return objects
