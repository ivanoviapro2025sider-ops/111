"""Parser for 1C Document metadata objects."""

from __future__ import annotations

import os
import re
from typing import List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_type_value, parse_types_from_element, parse_xml_file


_REGISTER_PATTERNS = [
    (r"(?:cfg:)?AccumulationRegister(?:RecordKey)?\.([A-Za-zА-Яа-я0-9_]+)", "AccumulationRegister"),
    (r"(?:cfg:)?InformationRegister(?:RecordKey)?\.([A-Za-zА-Яа-я0-9_]+)", "InformationRegister"),
    (r"(?:cfg:)?AccountingRegister(?:RecordKey)?\.([A-Za-zА-Яа-я0-9_]+)", "AccountingRegister"),
    (r"(?:cfg:)?CalculationRegister(?:RecordKey)?\.([A-Za-zА-Яа-я0-9_]+)", "CalculationRegister"),
]


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
    parsed_types = []
    for container in get_xml_elements(attribute_node, ".//*[local-name()='Type']"):
        parsed_types.extend(parse_types_from_element(container))
    if not parsed_types:
        single = parse_type_value(attribute_node)
        if single:
            parsed_types.append(single)

    types = [TypeRef(obj_type=item["type"], name=item["name"], full_type=item["full_type"]) for item in parsed_types]
    return AttributeInfo(name=name, types=types, tabular_section=tabular_section)


def _extract_based_on(root) -> List[str]:
    values: List[str] = []
    for node in get_xml_elements(root, ".//*[local-name()='BasedOn']//*[local-name()='Type']"):
        for item in parse_types_from_element(node):
            if item["type"] == "Document":
                values.append(item["name"])
    return sorted(set(values))


def _extract_movement_registers(root) -> List[str]:
    xml_text = ""
    try:
        xml_text = root.xpath("string(.)")
    except Exception:
        return []
    registers = set()
    for pattern, reg_type in _REGISTER_PATTERNS:
        for match in re.finditer(pattern, xml_text, flags=re.IGNORECASE):
            registers.add(f"{reg_type}.{match.group(1)}")
    return sorted(registers)


def parse_document(document_xml_path: str) -> ObjectInfo:
    """Parse document metadata XML file into ObjectInfo."""
    root = parse_xml_file(document_xml_path)
    name = _extract_object_name(document_xml_path)
    obj = ObjectInfo(name=name, obj_type="Document", path=os.path.dirname(document_xml_path))
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

    for attr_node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
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

    for section_node in get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']"):
        section_name = get_xml_text(section_node, ".//*[local-name()='Name']") or "UnknownSection"
        ts = TabularSectionInfo(name=section_name)
        for section_attr in get_xml_elements(section_node, ".//*[local-name()='Attribute']"):
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

    obj.based_on = _extract_based_on(root)
    obj.movement_registers = _extract_movement_registers(root)
    return obj


def parse_document_files(document_xml_paths: List[str]) -> List[ObjectInfo]:
    return [parse_document(path) for path in document_xml_paths]
