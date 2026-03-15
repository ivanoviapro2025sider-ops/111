"""Document metadata parser."""

from __future__ import annotations

import re
from typing import Dict

from models import ObjectInfo
from scanner import (
    collect_references,
    dedupe_references,
    extract_attributes,
    extract_tabular_sections,
    get_xml_elements,
    get_xml_text,
    load_object_xml,
)
from xml_helpers import parse_types_from_element


_REGISTER_PATTERN = re.compile(
    r"(InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister)\.([A-Za-zА-Яа-я0-9_]+)"
)


def _collect_movement_registers(root) -> list:
    registers = []
    xml_text = "".join(root.itertext())
    for match in _REGISTER_PATTERN.finditer(xml_text):
        register_name = f"{match.group(1)}.{match.group(2)}"
        registers.append(register_name)
    return sorted(set(registers))


def _collect_based_on(root) -> list:
    based_on = []
    for node in get_xml_elements(root, ".//*[local-name()='BasedOn']//*[local-name()='Type' or local-name()='TypeSet']"):
        for item in parse_types_from_element(node):
            if item["type"] in {"Document", "Catalog", "BusinessProcess", "Task"}:
                based_on.append(f"{item['type']}.{item['name']}")
    return sorted(set(based_on))


def parse_document(obj_info: ObjectInfo) -> ObjectInfo:
    """Parse a document object in place."""

    root = load_object_xml(obj_info)
    if root is None:
        return obj_info

    obj_info.attributes = extract_attributes(root)
    obj_info.tabular_sections = extract_tabular_sections(root)

    references = collect_references(obj_info.attributes)
    for section in obj_info.tabular_sections:
        references.extend(collect_references(section.attributes))

    obj_info.references = dedupe_references(references)
    obj_info.movement_registers = _collect_movement_registers(root)
    obj_info.based_on = _collect_based_on(root)

    posting_mode = get_xml_text(root, ".//*[local-name()='Posting']/text()", "")
    if posting_mode:
        obj_info.properties["Posting"] = posting_mode

    return obj_info


def parse_documents(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type == "Document":
            objects[key] = parse_document(obj_info)
    return objects
