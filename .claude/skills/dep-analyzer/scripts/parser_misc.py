"""Parsers for miscellaneous metadata objects."""

from __future__ import annotations

from typing import Dict

from models import ObjectInfo, ReferenceInfo
from scanner import (
    collect_references,
    dedupe_references,
    extract_attributes,
    extract_tabular_sections,
    get_xml_elements,
    get_xml_text,
    load_object_xml,
    parse_boolean,
)
from xml_helpers import parse_types_from_element


MISC_TYPES = {
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


def _parse_common_module(obj_info: ObjectInfo, root) -> None:
    obj_info.is_global = parse_boolean(get_xml_text(root, ".//*[local-name()='Global']/text()", "false"))
    obj_info.is_server = parse_boolean(get_xml_text(root, ".//*[local-name()='Server']/text()", "false"))
    obj_info.is_client = parse_boolean(get_xml_text(root, ".//*[local-name()='ClientManagedApplication']/text()", "false")) or parse_boolean(
        get_xml_text(root, ".//*[local-name()='ClientOrdinaryApplication']/text()", "false")
    )
    obj_info.is_external = parse_boolean(
        get_xml_text(root, ".//*[local-name()='ExternalConnection']/text()", "false")
    )


def _parse_event_subscription(obj_info: ObjectInfo, root) -> None:
    obj_info.handler = get_xml_text(root, ".//*[local-name()='Handler']/text()", "")
    obj_info.event = get_xml_text(root, ".//*[local-name()='Event']/text()", "")

    source_types = []
    for node in get_xml_elements(root, ".//*[local-name()='Source']//*[local-name()='Type' or local-name()='TypeSet']"):
        for item in parse_types_from_element(node):
            source_types.append(f"{item['type']}.{item['name']}")
    obj_info.source_types = sorted(set(source_types))


def parse_misc_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Parse a non-catalog, non-document, non-register object."""

    root = load_object_xml(obj_info)
    if root is None:
        return obj_info

    obj_info.attributes = extract_attributes(root)
    obj_info.tabular_sections = extract_tabular_sections(root)

    references = collect_references(obj_info.attributes)
    for section in obj_info.tabular_sections:
        references.extend(collect_references(section.attributes))

    if obj_info.obj_type == "CommonModule":
        _parse_common_module(obj_info, root)
    elif obj_info.obj_type == "EventSubscription":
        _parse_event_subscription(obj_info, root)
    elif obj_info.obj_type == "Constant":
        for node in get_xml_elements(root, ".//*[local-name()='Type' or local-name()='TypeSet']"):
            for item in parse_types_from_element(node):
                if item["type"] in MISC_TYPES or item["type"] in {
                    "Catalog",
                    "Document",
                    "InformationRegister",
                    "AccumulationRegister",
                    "AccountingRegister",
                    "CalculationRegister",
                }:
                    references.append(
                        ReferenceInfo(
                            source_attribute=obj_info.name,
                            target_type=item["type"],
                            target_name=item["name"],
                            ref_kind="attribute",
                        )
                    )
            break

    obj_info.references = dedupe_references(references)
    return obj_info


def parse_misc(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type in MISC_TYPES:
            objects[key] = parse_misc_object(obj_info)
    return objects
