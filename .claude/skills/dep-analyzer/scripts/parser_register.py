"""Register metadata parser for all register families."""

from __future__ import annotations

from typing import List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import parse_types_from_element, parse_xml_file


def _first_text(element, name: str) -> str:
    values = element.xpath(f".//*[local-name()='{name}'][1]/text()")
    return str(values[0]).strip() if values else ""


def _leaf_properties(root) -> dict:
    result = {}
    for element in root.xpath(".//*[local-name()='Properties'][1]/*"):
        if len(element) == 0:
            key = element.tag.rsplit("}", 1)[-1]
            value = (element.text or "").strip()
            if value:
                result[key] = value
    return result


def _convert_types(type_dicts: List[dict]) -> List[TypeRef]:
    return [TypeRef(obj_type=item["type"], name=item["name"], full_type=item["full_type"]) for item in type_dicts]


def _parse_item(element, *, is_dimension: bool = False, is_resource: bool = False) -> AttributeInfo:
    name = _first_text(element, "Name")
    type_container = None
    found = element.xpath(".//*[local-name()='Type' or local-name()='TypeSet']")
    if found:
        type_container = found[0].getparent() if found[0].getparent() is not None else found[0]
    types = _convert_types(parse_types_from_element(type_container or element))
    return AttributeInfo(name=name, types=types, is_dimension=is_dimension, is_resource=is_resource)


def _append_references(obj: ObjectInfo, attribute: AttributeInfo, ref_kind: str) -> None:
    for type_ref in attribute.types:
        if type_ref.obj_type in {"Primitive", "Unknown"}:
            continue
        obj.references.append(
            ReferenceInfo(
                source_attribute=attribute.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                ref_kind=ref_kind,
            )
        )


def _parse_register(obj: ObjectInfo) -> ObjectInfo:
    xml_path = obj.properties.get("xml_path", "")
    root = parse_xml_file(xml_path)
    if root is None:
        return obj

    obj.synonym = _first_text(root, "Synonym") or obj.synonym
    obj.comment = _first_text(root, "Comment") or obj.comment
    obj.properties.update(_leaf_properties(root))

    for element in root.xpath(".//*[local-name()='Dimension']"):
        attribute = _parse_item(element, is_dimension=True)
        if attribute.name:
            obj.attributes.append(attribute)
            _append_references(obj, attribute, "dimension")

    for element in root.xpath(".//*[local-name()='Resource']"):
        attribute = _parse_item(element, is_resource=True)
        if attribute.name:
            obj.attributes.append(attribute)
            _append_references(obj, attribute, "resource")

    for element in root.xpath(".//*[local-name()='Attribute' or local-name()='StandardAttribute']"):
        if element.xpath("ancestor::*[local-name()='Dimensions' or local-name()='Resources']"):
            continue
        attribute = _parse_item(element)
        if attribute.name:
            obj.attributes.append(attribute)
            _append_references(obj, attribute, "attribute")

    for element in root.xpath(".//*[local-name()='Recorder' or local-name()='Recorders' or local-name()='RecorderType']"):
        for type_info in parse_types_from_element(element):
            if type_info["type"] in {"Primitive", "Unknown"}:
                continue
            obj.references.append(
                ReferenceInfo(
                    source_attribute="Recorder",
                    target_type=type_info["type"],
                    target_name=type_info["name"],
                    ref_kind="recorder",
                )
            )

    return obj


def parse_registers(objects: List[ObjectInfo]) -> List[ObjectInfo]:
    for obj in objects:
        _parse_register(obj)
    return objects
