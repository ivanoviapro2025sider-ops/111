"""Parsers for subscriptions, common modules, and other misc metadata objects."""

from __future__ import annotations

from typing import Dict, List

from models import ObjectInfo, ReferenceInfo
from xml_helpers import parse_types_from_element, parse_xml_file


_REFERENCE_TYPES = {
    "Catalog",
    "Document",
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "DefinedType",
}

_GENERIC_TYPES = {
    "Report",
    "DataProcessor",
    "CommonModule",
    "EventSubscription",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "Constant",
    "DocumentJournal",
    "ScheduledJob",
    "DefinedType",
    "HTTPService",
    "WebService",
}


def _text_of_first(element, *names: str) -> str:
    for name in names:
        found = element.xpath(f"./*[local-name()='{name}']")
        if found:
            value = "".join(found[0].itertext()).strip()
            if value:
                return value
    return ""


def _append_reference(obj_info: ObjectInfo, ref_info: ReferenceInfo) -> None:
    signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
    existing = {(ref.source_attribute, ref.target_type, ref.target_name, ref.tabular_section, ref.ref_kind) for ref in obj_info.references}
    if signature not in existing:
        obj_info.references.append(ref_info)


def _parse_subscription(obj_info: ObjectInfo) -> None:
    xml_path = obj_info.properties.get("xml_path", "")
    root = parse_xml_file(xml_path) if xml_path else None
    if root is None:
        return

    obj_info.handler = _text_of_first(root, "Handler", "HandlerName")
    obj_info.event = _text_of_first(root, "Event")

    source_types: List[str] = []
    for source_node in root.xpath(".//*[local-name()='Source' or local-name()='Sources']"):
        for type_info in parse_types_from_element(source_node):
            source_types.append(f"{type_info['type']}.{type_info['name']}")
    obj_info.source_types = sorted(set(source_types))


def _parse_common_module(obj_info: ObjectInfo) -> None:
    xml_path = obj_info.properties.get("xml_path", "")
    root = parse_xml_file(xml_path) if xml_path else None
    if root is None:
        return

    obj_info.synonym = obj_info.synonym or _text_of_first(root, "Synonym", "Presentation")
    obj_info.comment = obj_info.comment or _text_of_first(root, "Comment")
    if not obj_info.properties.get("name"):
        obj_info.properties["name"] = _text_of_first(root, "Name") or obj_info.name


def _parse_generic_references(obj_info: ObjectInfo) -> None:
    xml_path = obj_info.properties.get("xml_path", "")
    root = parse_xml_file(xml_path) if xml_path else None
    if root is None:
        return

    seen = {(ref.source_attribute, ref.target_type, ref.target_name, ref.tabular_section, ref.ref_kind) for ref in obj_info.references}
    for type_node in root.xpath(".//*[local-name()='Type' or local-name()='TypeSet' or local-name()='ValueType' or local-name()='Types']"):
        for type_info in parse_types_from_element(type_node):
            if type_info["type"] not in _REFERENCE_TYPES:
                continue
            ref_info = ReferenceInfo(
                source_attribute="<xml>",
                target_type=type_info["type"],
                target_name=type_info["name"],
                ref_kind="attribute",
            )
            signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
            if signature in seen:
                continue
            obj_info.references.append(ref_info)
            seen.add(signature)


def parse_misc_objects(object_index: Dict[str, ObjectInfo]) -> None:
    """Parse event subscriptions, common modules, and generic metadata objects."""

    for obj_info in object_index.values():
        if obj_info.obj_type == "EventSubscription":
            _parse_subscription(obj_info)
        elif obj_info.obj_type == "CommonModule":
            _parse_common_module(obj_info)
        elif obj_info.obj_type in _GENERIC_TYPES:
            _parse_generic_references(obj_info)
