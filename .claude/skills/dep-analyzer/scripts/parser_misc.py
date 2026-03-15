"""Parser for misc metadata objects and subscriptions/common modules."""

from __future__ import annotations

import os
from typing import Dict, Optional, Set

from models import ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file

MISC_TYPES: Set[str] = {
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "Report",
    "DataProcessor",
    "CommonModule",
    "EventSubscription",
    "Constant",
    "DocumentJournal",
    "ScheduledJob",
    "DefinedType",
    "HTTPService",
    "WebService",
}


def _resolve_xml_path(obj: ObjectInfo) -> Optional[str]:
    if not obj.path:
        return None
    if os.path.isfile(obj.path) and obj.path.lower().endswith(".xml"):
        return obj.path

    candidates = [
        os.path.join(obj.path, f"{obj.name}.xml"),
        os.path.join(obj.path, f"{obj.obj_type}.xml"),
        f"{obj.path}.xml",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _parse_common_module_flags(obj: ObjectInfo, root) -> None:
    obj.is_global = get_xml_text(root, ".//*[local-name()='Global']/text()", "false").lower() == "true"
    obj.is_server = get_xml_text(root, ".//*[local-name()='Server']/text()", "false").lower() == "true"
    obj.is_client = get_xml_text(root, ".//*[local-name()='Client']/text()", "false").lower() == "true"
    obj.is_external = get_xml_text(root, ".//*[local-name()='ExternalConnection']/text()", "false").lower() == "true"


def _parse_subscription(obj: ObjectInfo, root) -> None:
    obj.handler = (
        get_xml_text(root, ".//*[local-name()='Handler']/text()")
        or get_xml_text(root, ".//*[local-name()='Action']/text()")
        or get_xml_text(root, ".//*[local-name()='Method']/text()")
    )
    obj.event = get_xml_text(root, ".//*[local-name()='Event']/text()")
    for source_type in get_xml_elements(root, ".//*[local-name()='Source']//*[local-name()='Type']/text()"):
        value = str(source_type).strip()
        if value:
            obj.source_types.append(value)


def _parse_generic_type_references(obj: ObjectInfo, root) -> None:
    # Constants / defined types / generic typed metadata nodes.
    for parent in get_xml_elements(root, ".//*[local-name()='Type']/.."):
        source_name = get_xml_text(parent, "./*[local-name()='Name']/text()", "Type")
        type_container = get_xml_elements(parent, "./*[local-name()='Type']")
        if not type_container:
            continue
        for type_data in parse_types_from_element(type_container[0]):
            obj_type = type_data["type"]
            if obj_type in {"Primitive", "Unknown"}:
                continue
            obj.references.append(
                ReferenceInfo(
                    source_attribute=source_name,
                    target_type=obj_type,
                    target_name=type_data["name"],
                    ref_kind="attribute",
                )
            )
            obj.properties.setdefault(
                f"type:{source_name}",
                type_data["full_type"],
            )


def parse_misc(objects: Dict[str, ObjectInfo]) -> None:
    """Parse metadata for miscellaneous object types."""
    for obj in objects.values():
        if obj.obj_type not in MISC_TYPES:
            continue

        xml_path = _resolve_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item']/text()", obj.synonym)
        obj.comment = get_xml_text(root, ".//*[local-name()='Comment']/text()", obj.comment)

        if obj.obj_type == "CommonModule":
            _parse_common_module_flags(obj, root)
        elif obj.obj_type == "EventSubscription":
            _parse_subscription(obj, root)
        elif obj.obj_type == "DefinedType":
            # Dedicated output in properties for easier troubleshooting.
            type_nodes = get_xml_elements(root, ".//*[local-name()='Type']")
            for idx, type_node in enumerate(type_nodes, start=1):
                for parsed_type in parse_types_from_element(type_node):
                    obj.properties[f"defined_type_{idx}"] = parsed_type["full_type"]

        _parse_generic_type_references(obj, root)

        # Parse forms/templates/commands where available.
        for tag, destination in (
            ("Form", obj.forms),
            ("Template", obj.templates),
            ("Command", obj.commands),
        ):
            for element in get_xml_elements(root, f".//*[local-name()='{tag}']"):
                name = get_xml_text(element, "./*[local-name()='Name']/text()")
                if name:
                    destination.append(name)
