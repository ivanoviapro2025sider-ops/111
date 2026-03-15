"""Parsers for 1C register metadata objects."""

from __future__ import annotations

from typing import Dict, Iterable, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import parse_types_from_element, parse_xml_file


_REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}

_META_TYPES = _REGISTER_TYPES | {
    "Catalog",
    "Document",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "DefinedType",
}


def _text_of_first(element, *names: str) -> str:
    for name in names:
        found = element.xpath(f"./*[local-name()='{name}']")
        if found:
            value = "".join(found[0].itertext()).strip()
            if value:
                return value
    return ""


def _parse_types(element) -> List[TypeRef]:
    type_nodes = element.xpath(".//*[local-name()='Type' or local-name()='TypeSet' or local-name()='ValueType' or local-name()='Types']")
    parsed = []
    seen = set()
    for type_node in type_nodes or [element]:
        for type_info in parse_types_from_element(type_node):
            signature = (type_info["type"], type_info["name"], type_info["full_type"])
            if signature in seen:
                continue
            seen.add(signature)
            parsed.append(TypeRef(obj_type=type_info["type"], name=type_info["name"], full_type=type_info["full_type"]))
    return parsed


def _parse_attribute(element, *, is_dimension: bool = False, is_resource: bool = False) -> AttributeInfo:
    return AttributeInfo(
        name=_text_of_first(element, "Name") or element.get("name") or element.get("Name") or "",
        types=_parse_types(element),
        is_dimension=is_dimension,
        is_resource=is_resource,
    )


def _iter_reference_infos(attribute: AttributeInfo, ref_kind: str = "attribute") -> Iterable[ReferenceInfo]:
    for type_ref in attribute.types:
        if type_ref.obj_type not in _META_TYPES:
            continue
        yield ReferenceInfo(
            source_attribute=attribute.name,
            target_type=type_ref.obj_type,
            target_name=type_ref.name,
            ref_kind=ref_kind,
        )


def parse_registers(object_index: Dict[str, ObjectInfo]) -> None:
    """Enrich register objects with dimensions, resources, and recorder references."""

    for obj_info in object_index.values():
        if obj_info.obj_type not in _REGISTER_TYPES:
            continue

        xml_path = obj_info.properties.get("xml_path", "")
        root = parse_xml_file(xml_path) if xml_path else None
        if root is None:
            continue

        attributes: List[AttributeInfo] = []
        references: List[ReferenceInfo] = list(obj_info.references)
        ref_signatures = {(ref.source_attribute, ref.target_type, ref.target_name, ref.tabular_section, ref.ref_kind) for ref in references}

        for dimension_node in root.xpath(".//*[local-name()='Dimension']"):
            dimension = _parse_attribute(dimension_node, is_dimension=True)
            if not dimension.name:
                continue
            attributes.append(dimension)
            for ref_info in _iter_reference_infos(dimension, ref_kind="dimension"):
                signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
                if signature not in ref_signatures:
                    ref_signatures.add(signature)
                    references.append(ref_info)

        for resource_node in root.xpath(".//*[local-name()='Resource']"):
            resource = _parse_attribute(resource_node, is_resource=True)
            if not resource.name:
                continue
            attributes.append(resource)
            for ref_info in _iter_reference_infos(resource, ref_kind="resource"):
                signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
                if signature not in ref_signatures:
                    ref_signatures.add(signature)
                    references.append(ref_info)

        attr_nodes = root.xpath(
            ".//*[local-name()='Attribute' and not(ancestor::*[local-name()='Dimension']) and not(ancestor::*[local-name()='Resource'])]"
        )
        for attr_node in attr_nodes:
            attribute = _parse_attribute(attr_node)
            if not attribute.name:
                continue
            attributes.append(attribute)
            for ref_info in _iter_reference_infos(attribute):
                signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
                if signature not in ref_signatures:
                    ref_signatures.add(signature)
                    references.append(ref_info)

        for recorder_node in root.xpath(".//*[local-name()='Recorder' or local-name()='Recorders' or local-name()='RecorderType']"):
            for type_info in parse_types_from_element(recorder_node):
                if type_info["type"] != "Document":
                    continue
                ref_info = ReferenceInfo(
                    source_attribute="<recorder>",
                    target_type="Document",
                    target_name=type_info["name"],
                    ref_kind="recorder",
                )
                signature = (ref_info.source_attribute, ref_info.target_type, ref_info.target_name, ref_info.tabular_section, ref_info.ref_kind)
                if signature not in ref_signatures:
                    ref_signatures.add(signature)
                    references.append(ref_info)

        obj_info.attributes = attributes
        obj_info.references = references
