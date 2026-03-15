"""Document metadata parser."""

from __future__ import annotations

import os
from typing import Dict, Optional

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


def _resolve_xml_path(obj: ObjectInfo) -> Optional[str]:
    if not obj.path:
        return None
    if os.path.isfile(obj.path) and obj.path.lower().endswith(".xml"):
        return obj.path
    candidates = [
        os.path.join(obj.path, f"{obj.name}.xml"),
        os.path.join(obj.path, "Document.xml"),
        f"{obj.path}.xml",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _parse_attribute(attr_element, tabular_section: str = "") -> AttributeInfo:
    attr_name = get_xml_text(attr_element, "./*[local-name()='Name']/text()")
    attr = AttributeInfo(name=attr_name, tabular_section=tabular_section)
    type_container = get_xml_elements(attr_element, "./*[local-name()='Type']")
    if type_container:
        for type_data in parse_types_from_element(type_container[0]):
            attr.types.append(TypeRef(type_data["type"], type_data["name"], type_data["full_type"]))
    return attr


def parse_documents(objects: Dict[str, ObjectInfo]) -> None:
    """Parse document objects in-place."""
    for obj in objects.values():
        if obj.obj_type != "Document":
            continue

        xml_path = _resolve_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item']/text()", obj.synonym)
        obj.comment = get_xml_text(root, ".//*[local-name()='Comment']/text()", obj.comment)

        for attr_element in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
            attr = _parse_attribute(attr_element)
            obj.attributes.append(attr)
            for type_ref in attr.types:
                if type_ref.obj_type not in {"Primitive", "Unknown"}:
                    obj.references.append(
                        ReferenceInfo(
                            source_attribute=attr.name,
                            target_type=type_ref.obj_type,
                            target_name=type_ref.name,
                            ref_kind="attribute",
                        )
                    )

        for ts_element in get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']"):
            ts_name = get_xml_text(ts_element, "./*[local-name()='Name']/text()")
            tabular_section = TabularSectionInfo(name=ts_name)
            for attr_element in get_xml_elements(ts_element, ".//*[local-name()='Attribute']"):
                attr = _parse_attribute(attr_element, ts_name)
                tabular_section.attributes.append(attr)
                for type_ref in attr.types:
                    if type_ref.obj_type not in {"Primitive", "Unknown"}:
                        obj.references.append(
                            ReferenceInfo(
                                source_attribute=attr.name,
                                target_type=type_ref.obj_type,
                                target_name=type_ref.name,
                                tabular_section=ts_name,
                                ref_kind="attribute",
                            )
                        )
            obj.tabular_sections.append(tabular_section)

        for register in get_xml_elements(root, ".//*[local-name()='Registers']//*[local-name()='Register']"):
            register_name = get_xml_text(register, "./*[local-name()='Name']/text()")
            register_type = get_xml_text(register, "./*[local-name()='Type']/text()")
            if register_name:
                qualified = f"{register_type}.{register_name}" if register_type else register_name
                obj.movement_registers.append(qualified)

        for based_on in get_xml_elements(root, ".//*[local-name()='BasedOn']//*[local-name()='Item']"):
            target_type = get_xml_text(based_on, "./*[local-name()='Type']/text()")
            target_name = get_xml_text(based_on, "./*[local-name()='Name']/text()")
            if target_type and target_name:
                obj.based_on.append(f"{target_type}.{target_name}")
                obj.references.append(
                    ReferenceInfo(
                        source_attribute="BasedOn",
                        target_type=target_type,
                        target_name=target_name,
                        ref_kind="based_on",
                    )
                )

        obj.forms.extend(
            name
            for name in (
                get_xml_text(el, "./*[local-name()='Name']/text()")
                for el in get_xml_elements(root, ".//*[local-name()='Forms']//*[local-name()='Form']")
            )
            if name
        )
        obj.templates.extend(
            name
            for name in (
                get_xml_text(el, "./*[local-name()='Name']/text()")
                for el in get_xml_elements(root, ".//*[local-name()='Templates']//*[local-name()='Template']")
            )
            if name
        )
        obj.commands.extend(
            name
            for name in (
                get_xml_text(el, "./*[local-name()='Name']/text()")
                for el in get_xml_elements(root, ".//*[local-name()='Commands']//*[local-name()='Command']")
            )
            if name
        )
