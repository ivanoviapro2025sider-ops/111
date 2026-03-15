"""Parser for Document metadata objects."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from scanner import iter_object_xml_candidates
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


def _to_typerefs(parsed_types: List[dict]) -> List[TypeRef]:
    return [
        TypeRef(
            obj_type=item.get("type", "Unknown"),
            name=item.get("name", ""),
            full_type=item.get("full_type", ""),
        )
        for item in parsed_types
    ]


def _extract_attr(node, tabular_section: str = "") -> AttributeInfo:
    type_nodes = get_xml_elements(node, "./*[local-name()='Type']|./*[local-name()='TypeSet']")
    parsed_types: List[dict] = []
    for type_node in type_nodes:
        parsed_types.extend(parse_types_from_element(type_node))
    return AttributeInfo(
        name=get_xml_text(node, "./*[local-name()='Name']"),
        types=_to_typerefs(parsed_types),
        tabular_section=tabular_section,
    )


def _add_references(obj_info: ObjectInfo, attr: AttributeInfo) -> None:
    for type_ref in attr.types:
        if type_ref.obj_type in {"Primitive", "Unknown", "DefinedType"}:
            continue
        obj_info.references.append(
            ReferenceInfo(
                source_attribute=attr.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attr.tabular_section,
                ref_kind="attribute",
            )
        )


def parse_document(obj_info: ObjectInfo) -> None:
    """Parse single document metadata XML and enrich object info."""
    for xml_file in iter_object_xml_candidates(obj_info):
        root = parse_xml_file(str(xml_file))
        if root is None:
            continue

        obj_info.synonym = obj_info.synonym or get_xml_text(
            root, ".//*[local-name()='Synonym']/*[local-name()='item']"
        )
        obj_info.comment = obj_info.comment or get_xml_text(root, ".//*[local-name()='Comment']")

        attr_nodes = get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']")
        for node in attr_nodes:
            attr = _extract_attr(node)
            if not attr.name:
                continue
            obj_info.attributes.append(attr)
            _add_references(obj_info, attr)

        ts_nodes = get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']")
        for ts_node in ts_nodes:
            ts_name = get_xml_text(ts_node, "./*[local-name()='Name']")
            ts_info = TabularSectionInfo(name=ts_name)
            for ts_attr in get_xml_elements(ts_node, ".//*[local-name()='Attribute']"):
                attr = _extract_attr(ts_attr, tabular_section=ts_name)
                if not attr.name:
                    continue
                ts_info.attributes.append(attr)
                _add_references(obj_info, attr)
            if ts_info.name or ts_info.attributes:
                obj_info.tabular_sections.append(ts_info)

        # Ввод на основании
        based_on_types = get_xml_elements(
            root,
            ".//*[local-name()='BasedOn']//*[local-name()='Type']|"
            ".//*[local-name()='InputBy']//*[local-name()='Type']",
        )
        for type_node in based_on_types:
            for parsed in parse_types_from_element(type_node):
                if parsed.get("type") == "Document":
                    target = parsed.get("name", "")
                    if target and target not in obj_info.based_on:
                        obj_info.based_on.append(target)
                        obj_info.references.append(
                            ReferenceInfo(
                                source_attribute="BasedOn",
                                target_type="Document",
                                target_name=target,
                                ref_kind="based_on",
                            )
                        )

        # Движения по регистрам
        movement_nodes = get_xml_elements(
            root,
            ".//*[contains(local-name(),'Register')]//*[local-name()='Type']|"
            ".//*[contains(local-name(),'Movement')]//*[local-name()='Type']",
        )
        for node in movement_nodes:
            for parsed in parse_types_from_element(node):
                reg_type = parsed.get("type", "")
                if not reg_type.endswith("Register"):
                    continue
                reg_name = parsed.get("name", "")
                if reg_name and reg_name not in obj_info.movement_registers:
                    obj_info.movement_registers.append(reg_name)
        break


def parse_documents(objects: Dict[str, ObjectInfo]) -> None:
    """Parse all documents from indexed metadata objects."""
    for obj in objects.values():
        if obj.obj_type == "Document":
            parse_document(obj)
