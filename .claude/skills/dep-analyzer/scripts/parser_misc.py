"""Parser for miscellaneous metadata objects."""

from __future__ import annotations

from typing import Dict, List

from models import ObjectInfo, ReferenceInfo
from scanner import iter_object_xml_candidates
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file

MISC_TYPES = {
    "EventSubscription",
    "CommonModule",
    "Enum",
    "Report",
    "DataProcessor",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "Constant",
    "DocumentJournal",
    "ScheduledJob",
    "DefinedType",
    "HTTPService",
    "WebService",
    "ChartOfAccounts",
    "ChartOfCharacteristicTypes",
    "ChartOfCalculationTypes",
}


def _parse_subscription(obj_info: ObjectInfo, root) -> None:
    obj_info.handler = get_xml_text(root, ".//*[local-name()='Handler']")
    obj_info.event = get_xml_text(root, ".//*[local-name()='Event']")

    source_type_nodes = get_xml_elements(root, ".//*[local-name()='Source']//*[local-name()='Type']")
    for type_node in source_type_nodes:
        for parsed in parse_types_from_element(type_node):
            source = f"{parsed.get('type')}.{parsed.get('name')}"
            if source and source not in obj_info.source_types:
                obj_info.source_types.append(source)
            if parsed.get("type") not in {"Primitive", "Unknown", "DefinedType"}:
                obj_info.references.append(
                    ReferenceInfo(
                        source_attribute="Source",
                        target_type=parsed.get("type", ""),
                        target_name=parsed.get("name", ""),
                        ref_kind="subscription_source",
                    )
                )

    if obj_info.handler:
        # Часто обработчик хранится как "ModuleName.MethodName"
        module_name = obj_info.handler.split(".")[0]
        obj_info.references.append(
            ReferenceInfo(
                source_attribute="Handler",
                target_type="CommonModule",
                target_name=module_name,
                ref_kind="subscription_handler",
            )
        )


def _parse_common_module(obj_info: ObjectInfo, root) -> None:
    obj_info.is_global = get_xml_text(root, ".//*[local-name()='Global']").lower() == "true"
    obj_info.is_server = get_xml_text(root, ".//*[local-name()='Server']").lower() == "true"
    obj_info.is_client = get_xml_text(root, ".//*[local-name()='Client']").lower() == "true"
    obj_info.is_external = get_xml_text(root, ".//*[local-name()='ExternalConnection']").lower() == "true"


def _parse_generic_type_references(obj_info: ObjectInfo, root) -> None:
    type_nodes = get_xml_elements(root, ".//*[local-name()='Type']|.//*[local-name()='TypeSet']")
    seen: set[tuple[str, str, str]] = set()
    for type_node in type_nodes:
        for parsed in parse_types_from_element(type_node):
            target_type = parsed.get("type", "")
            target_name = parsed.get("name", "")
            if target_type in {"Primitive", "Unknown", "DefinedType"}:
                continue
            key = ("Type", target_type, target_name)
            if key in seen:
                continue
            seen.add(key)
            obj_info.references.append(
                ReferenceInfo(
                    source_attribute="Type",
                    target_type=target_type,
                    target_name=target_name,
                    ref_kind="attribute",
                )
            )


def parse_misc_object(obj_info: ObjectInfo) -> None:
    """Parse one miscellaneous object by type-specific rules."""
    for xml_file in iter_object_xml_candidates(obj_info):
        root = parse_xml_file(str(xml_file))
        if root is None:
            continue

        obj_info.synonym = obj_info.synonym or get_xml_text(
            root, ".//*[local-name()='Synonym']/*[local-name()='item']"
        )
        obj_info.comment = obj_info.comment or get_xml_text(root, ".//*[local-name()='Comment']")

        if obj_info.obj_type == "EventSubscription":
            _parse_subscription(obj_info, root)
        elif obj_info.obj_type == "CommonModule":
            _parse_common_module(obj_info, root)

        _parse_generic_type_references(obj_info, root)
        break


def parse_misc(objects: Dict[str, ObjectInfo]) -> None:
    """Parse all miscellaneous object types."""
    for obj in objects.values():
        if obj.obj_type in MISC_TYPES:
            parse_misc_object(obj)
