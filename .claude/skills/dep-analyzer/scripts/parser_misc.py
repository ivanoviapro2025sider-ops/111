"""Parsers for miscellaneous 1C metadata object types."""

from __future__ import annotations

import os
from typing import List

from models import ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


def _extract_object_name(file_path: str) -> str:
    base = os.path.basename(file_path)
    if base.lower() == "object.xml":
        return os.path.basename(os.path.dirname(file_path))
    return os.path.splitext(base)[0]


def _parse_references_from_types(root, default_kind: str = "attribute") -> List[ReferenceInfo]:
    refs: List[ReferenceInfo] = []
    for type_node in get_xml_elements(root, ".//*[local-name()='Type']"):
        for parsed in parse_types_from_element(type_node):
            if parsed["type"] in {"Primitive", "Unknown", "DefinedType"}:
                continue
            refs.append(
                ReferenceInfo(
                    source_attribute=get_xml_text(type_node.getparent(), ".//*[local-name()='Name']") or "Type",
                    target_type=parsed["type"],
                    target_name=parsed["name"],
                    ref_kind=default_kind,
                )
            )
    unique = {}
    for ref in refs:
        unique[(ref.source_attribute, ref.target_type, ref.target_name, ref.ref_kind)] = ref
    return list(unique.values())


def parse_misc_object(xml_path: str, obj_type: str) -> ObjectInfo:
    """Parse object types handled by generic parser."""
    root = parse_xml_file(xml_path)
    name = _extract_object_name(xml_path)
    obj = ObjectInfo(name=name, obj_type=obj_type, path=os.path.dirname(xml_path))
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

    if obj_type == "CommonModule":
        obj.is_global = get_xml_text(root, ".//*[local-name()='Global']").lower() in {"true", "истина", "1"}
        obj.is_server = get_xml_text(root, ".//*[local-name()='Server']").lower() in {"true", "истина", "1"}
        obj.is_client = get_xml_text(root, ".//*[local-name()='Client']").lower() in {"true", "истина", "1"}
        obj.is_external = get_xml_text(root, ".//*[local-name()='ExternalConnection']").lower() in {"true", "истина", "1"}

    if obj_type == "EventSubscription":
        obj.event = get_xml_text(root, ".//*[local-name()='Event']")
        obj.handler = get_xml_text(root, ".//*[local-name()='Handler']")
        source_types = []
        for type_node in get_xml_elements(root, ".//*[local-name()='Source']//*[local-name()='Type']"):
            for parsed in parse_types_from_element(type_node):
                source_types.append(f"{parsed['type']}.{parsed['name']}")
                obj.references.append(
                    ReferenceInfo(
                        source_attribute="Source",
                        target_type=parsed["type"],
                        target_name=parsed["name"],
                        ref_kind="subscription_source",
                    )
                )
        obj.source_types = sorted(set(source_types))
        if obj.handler:
            handler_module = obj.handler.split(".")[0]
            obj.references.append(
                ReferenceInfo(
                    source_attribute="Handler",
                    target_type="CommonModule",
                    target_name=handler_module,
                    ref_kind="subscription_handler",
                )
            )

    obj.references.extend(_parse_references_from_types(root))
    return obj


def parse_misc_files(xml_paths: List[str], obj_type: str) -> List[ObjectInfo]:
    return [parse_misc_object(path, obj_type) for path in xml_paths]
