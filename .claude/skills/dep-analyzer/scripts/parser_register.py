"""Register metadata parser (information/accumulation/accounting/calculation)."""

from __future__ import annotations

import os
from typing import Dict, Optional, Set

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file

REGISTER_TYPES: Set[str] = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
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


def _parse_typed_item(element, *, is_dimension: bool = False, is_resource: bool = False) -> AttributeInfo:
    name = get_xml_text(element, "./*[local-name()='Name']/text()")
    attr = AttributeInfo(name=name, is_dimension=is_dimension, is_resource=is_resource)
    type_container = get_xml_elements(element, "./*[local-name()='Type']")
    if type_container:
        for type_data in parse_types_from_element(type_container[0]):
            attr.types.append(TypeRef(type_data["type"], type_data["name"], type_data["full_type"]))
    return attr


def parse_registers(objects: Dict[str, ObjectInfo]) -> None:
    """Parse register objects and populate register references."""
    for obj in objects.values():
        if obj.obj_type not in REGISTER_TYPES:
            continue

        xml_path = _resolve_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item']/text()", obj.synonym)
        obj.comment = get_xml_text(root, ".//*[local-name()='Comment']/text()", obj.comment)

        for dim in get_xml_elements(root, ".//*[local-name()='Dimensions']//*[local-name()='Dimension']"):
            dim_attr = _parse_typed_item(dim, is_dimension=True)
            obj.attributes.append(dim_attr)
            for type_ref in dim_attr.types:
                if type_ref.obj_type not in {"Primitive", "Unknown"}:
                    obj.references.append(
                        ReferenceInfo(
                            source_attribute=dim_attr.name,
                            target_type=type_ref.obj_type,
                            target_name=type_ref.name,
                            ref_kind="dimension",
                        )
                    )

        for resource in get_xml_elements(root, ".//*[local-name()='Resources']//*[local-name()='Resource']"):
            res_attr = _parse_typed_item(resource, is_resource=True)
            obj.attributes.append(res_attr)
            for type_ref in res_attr.types:
                if type_ref.obj_type not in {"Primitive", "Unknown"}:
                    obj.references.append(
                        ReferenceInfo(
                            source_attribute=res_attr.name,
                            target_type=type_ref.obj_type,
                            target_name=type_ref.name,
                            ref_kind="resource",
                        )
                    )

        for attr_element in get_xml_elements(root, ".//*[local-name()='Attributes']//*[local-name()='Attribute']"):
            attr = _parse_typed_item(attr_element)
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

        for recorder in get_xml_elements(root, ".//*[local-name()='Recorders']//*[local-name()='Recorder']"):
            recorder_name = get_xml_text(recorder, "./*[local-name()='Name']/text()")
            if recorder_name:
                obj.references.append(
                    ReferenceInfo(
                        source_attribute="Recorder",
                        target_type="Document",
                        target_name=recorder_name,
                        ref_kind="registrator",
                    )
                )
