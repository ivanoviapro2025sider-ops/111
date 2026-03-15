"""Document parser."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


REFERENCE_TYPES = {
    "Catalog",
    "Document",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def _guess_main_xml(obj: ObjectInfo) -> Optional[Path]:
    object_dir = Path(obj.path)
    candidates = [object_dir / f"{obj.name}.xml"]
    candidates.extend(sorted(object_dir.glob("*.xml")))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _extract_types(type_parent) -> List[TypeRef]:
    type_nodes = get_xml_elements(type_parent, ".//*[local-name()='Type']")
    if not type_nodes:
        type_nodes = [type_parent]

    refs: List[TypeRef] = []
    seen = set()
    for node in type_nodes:
        for info in parse_types_from_element(node):
            key = (info["type"], info["name"], info["full_type"])
            if key in seen:
                continue
            seen.add(key)
            refs.append(TypeRef(obj_type=info["type"], name=info["name"], full_type=info["full_type"]))
    return refs


def _parse_attribute(attr_node, tabular_section: str = "") -> AttributeInfo:
    attr_name = get_xml_text(attr_node, ".//*[local-name()='Name']")
    type_parent = get_xml_elements(attr_node, ".//*[local-name()='TypeDescription']")
    type_parent = type_parent[0] if type_parent else attr_node
    return AttributeInfo(name=attr_name, types=_extract_types(type_parent), tabular_section=tabular_section)


def _append_refs(obj: ObjectInfo, attr: AttributeInfo) -> None:
    for type_ref in attr.types:
        if type_ref.obj_type not in REFERENCE_TYPES:
            continue
        obj.references.append(
            ReferenceInfo(
                source_attribute=attr.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attr.tabular_section,
                ref_kind="attribute",
            )
        )


def parse_document_object(obj: ObjectInfo) -> None:
    xml_path = _guess_main_xml(obj)
    if xml_path is None:
        return

    root = parse_xml_file(str(xml_path))
    if root is None:
        return

    obj.attributes = []
    obj.tabular_sections = []
    obj.movement_registers = []
    obj.based_on = []

    for attr_node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
        attr = _parse_attribute(attr_node)
        if attr.name:
            obj.attributes.append(attr)
            _append_refs(obj, attr)

    for ts_node in get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']"):
        ts_name = get_xml_text(ts_node, ".//*[local-name()='Name']")
        ts_info = TabularSectionInfo(name=ts_name)
        for attr_node in get_xml_elements(ts_node, ".//*[local-name()='Attribute']"):
            attr = _parse_attribute(attr_node, tabular_section=ts_name)
            if attr.name:
                ts_info.attributes.append(attr)
                _append_refs(obj, attr)
        obj.tabular_sections.append(ts_info)

    for movement_node in get_xml_elements(root, ".//*[local-name()='RegisterRecords']//*[local-name()='RecordSet']"):
        register_name = (
            get_xml_text(movement_node, ".//*[local-name()='AccumulationRegister']")
            or get_xml_text(movement_node, ".//*[local-name()='InformationRegister']")
            or get_xml_text(movement_node, ".//*[local-name()='AccountingRegister']")
            or get_xml_text(movement_node, ".//*[local-name()='CalculationRegister']")
        )
        if register_name and register_name not in obj.movement_registers:
            obj.movement_registers.append(register_name)

    # Альтернативный путь (в части конфигураций движения описаны как Registers/*)
    for register_node in get_xml_elements(root, ".//*[local-name()='Registers']/*"):
        reg_name = (
            get_xml_text(register_node, ".//*[local-name()='AccumulationRegister']")
            or get_xml_text(register_node, ".//*[local-name()='InformationRegister']")
            or get_xml_text(register_node, ".//*[local-name()='AccountingRegister']")
            or get_xml_text(register_node, ".//*[local-name()='CalculationRegister']")
            or (getattr(register_node, "text", "") or "").strip()
        )
        if reg_name and reg_name not in obj.movement_registers:
            obj.movement_registers.append(reg_name)

    for based_on in get_xml_elements(root, ".//*[local-name()='BasedOn']//*[local-name()='Document']"):
        value = (based_on.text or "").strip()
        if value and value not in obj.based_on:
            obj.based_on.append(value)


def parse_documents(graph) -> None:
    for obj in graph.objects.values():
        if obj.obj_type == "Document":
            parse_document_object(obj)

