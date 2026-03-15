"""Parsers for non-catalog/document/register metadata objects."""

from __future__ import annotations

from typing import Iterable, List

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


def _to_bool(value: str) -> bool:
    return value.strip().lower() in {"true", "1", "yes"}


def _convert_types(type_dicts: List[dict]) -> List[TypeRef]:
    return [TypeRef(obj_type=item["type"], name=item["name"], full_type=item["full_type"]) for item in type_dicts]


def _add_reference_from_types(obj: ObjectInfo, source_attribute: str, type_dicts: List[dict], ref_kind: str = "attribute") -> None:
    for type_info in type_dicts:
        if type_info["type"] in {"Primitive", "Unknown"}:
            continue
        obj.references.append(
            ReferenceInfo(
                source_attribute=source_attribute,
                target_type=type_info["type"],
                target_name=type_info["name"],
                ref_kind=ref_kind,
            )
        )


def _parse_generic_attributes(root, obj: ObjectInfo) -> None:
    for element in root.xpath(".//*[local-name()='Attribute' or local-name()='StandardAttribute' or local-name()='Parameter']"):
        name = _first_text(element, "Name")
        if not name:
            continue
        types = _convert_types(parse_types_from_element(element))
        attribute = AttributeInfo(name=name, types=types)
        obj.attributes.append(attribute)
        _add_reference_from_types(obj, name, parse_types_from_element(element))


def _parse_common_module(root, obj: ObjectInfo) -> None:
    obj.is_global = _to_bool(_first_text(root, "Global"))
    obj.is_server = _to_bool(_first_text(root, "Server"))
    obj.is_client = _to_bool(_first_text(root, "ClientManagedApplication")) or _to_bool(_first_text(root, "ClientOrdinaryApplication"))
    obj.is_external = _to_bool(_first_text(root, "ExternalConnection"))


def _parse_event_subscription(root, obj: ObjectInfo) -> None:
    handler = _first_text(root, "Handler") or _first_text(root, "Action") or _first_text(root, "Method")
    event = _first_text(root, "Event")
    obj.handler = handler
    obj.event = event

    source_types = []
    for element in root.xpath(".//*[local-name()='Source' or local-name()='SourceType' or local-name()='EventSource']"):
        for type_info in parse_types_from_element(element):
            if type_info["type"] in {"Primitive", "Unknown"}:
                continue
            source_types.append(f"{type_info['type']}.{type_info['name']}")
    obj.source_types = sorted(set(source_types))


def _parse_constant(root, obj: ObjectInfo) -> None:
    type_dicts = parse_types_from_element(root)
    if type_dicts:
        obj.attributes.append(AttributeInfo(name="Value", types=_convert_types(type_dicts)))
        _add_reference_from_types(obj, "Value", type_dicts)


def _parse_defined_type(root, obj: ObjectInfo) -> None:
    type_dicts = parse_types_from_element(root)
    if type_dicts:
        obj.properties["Types"] = ", ".join(item["full_type"] for item in type_dicts)
        _add_reference_from_types(obj, "DefinedType", type_dicts)


def parse_misc_object(obj: ObjectInfo) -> ObjectInfo:
    xml_path = obj.properties.get("xml_path", "")
    root = parse_xml_file(xml_path)
    if root is None:
        return obj

    obj.synonym = _first_text(root, "Synonym") or obj.synonym
    obj.comment = _first_text(root, "Comment") or obj.comment
    obj.properties.update(_leaf_properties(root))

    if obj.obj_type == "CommonModule":
        _parse_common_module(root, obj)
    elif obj.obj_type == "EventSubscription":
        _parse_event_subscription(root, obj)
    elif obj.obj_type == "Constant":
        _parse_constant(root, obj)
    elif obj.obj_type == "DefinedType":
        _parse_defined_type(root, obj)
    else:
        _parse_generic_attributes(root, obj)

    return obj


def parse_misc_objects(objects: Iterable[ObjectInfo]) -> List[ObjectInfo]:
    parsed = []
    for obj in objects:
        parse_misc_object(obj)
        parsed.append(obj)
    return parsed
