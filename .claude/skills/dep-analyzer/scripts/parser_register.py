"""Parser for 1C register metadata objects."""

from __future__ import annotations

import os
import re
from typing import List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_type_value, parse_types_from_element, parse_xml_file


def _extract_object_name(file_path: str) -> str:
    base = os.path.basename(file_path)
    if base.lower() == "object.xml":
        return os.path.basename(os.path.dirname(file_path))
    return os.path.splitext(base)[0]


def _build_attribute(attribute_node, *, is_dimension: bool = False, is_resource: bool = False) -> AttributeInfo:
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
    return AttributeInfo(name=name, types=types, is_dimension=is_dimension, is_resource=is_resource)


def _extract_recorders(root) -> List[ReferenceInfo]:
    references: List[ReferenceInfo] = []
    xml_text = ""
    try:
        xml_text = root.xpath("string(.)")
    except Exception:
        return references
    for match in re.finditer(r"(?:cfg:)?DocumentRef\.([A-Za-zА-Яа-я0-9_]+)", xml_text, flags=re.IGNORECASE):
        references.append(
            ReferenceInfo(
                source_attribute="Recorder",
                target_type="Document",
                target_name=match.group(1),
                ref_kind="registrar",
            )
        )
    # Dedupe by target.
    unique = {}
    for ref in references:
        unique[(ref.target_type, ref.target_name, ref.source_attribute)] = ref
    return list(unique.values())


def parse_register(register_xml_path: str, register_type: str) -> ObjectInfo:
    """Parse register metadata XML file into ObjectInfo."""
    root = parse_xml_file(register_xml_path)
    name = _extract_object_name(register_xml_path)
    obj = ObjectInfo(name=name, obj_type=register_type, path=os.path.dirname(register_xml_path))
    if root is None:
        return obj

    obj.synonym = (
        get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item'][1]")
        or get_xml_text(root, ".//*[local-name()='Synonym']")
    )
    obj.comment = get_xml_text(root, ".//*[local-name()='Comment']")

    for node in get_xml_elements(root, ".//*[local-name()='Dimensions']/*[local-name()='Dimension']"):
        attribute = _build_attribute(node, is_dimension=True)
        obj.attributes.append(attribute)
        for typeref in attribute.types:
            if typeref.obj_type not in {"Primitive", "Unknown", "DefinedType"}:
                obj.references.append(
                    ReferenceInfo(
                        source_attribute=attribute.name,
                        target_type=typeref.obj_type,
                        target_name=typeref.name,
                        ref_kind="dimension",
                    )
                )

    for node in get_xml_elements(root, ".//*[local-name()='Resources']/*[local-name()='Resource']"):
        attribute = _build_attribute(node, is_resource=True)
        obj.attributes.append(attribute)
        for typeref in attribute.types:
            if typeref.obj_type not in {"Primitive", "Unknown", "DefinedType"}:
                obj.references.append(
                    ReferenceInfo(
                        source_attribute=attribute.name,
                        target_type=typeref.obj_type,
                        target_name=typeref.name,
                        ref_kind="resource",
                    )
                )

    for node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
        attribute = _build_attribute(node)
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

    obj.references.extend(_extract_recorders(root))
    return obj


def parse_register_files(register_xml_paths: List[str], register_type: str) -> List[ObjectInfo]:
    return [parse_register(path, register_type) for path in register_xml_paths]
