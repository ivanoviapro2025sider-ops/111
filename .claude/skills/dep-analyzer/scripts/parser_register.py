"""Parser for register metadata objects."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from scanner import iter_object_xml_candidates
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file

REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def _to_refs(types: List[dict]) -> List[TypeRef]:
    return [
        TypeRef(
            obj_type=item.get("type", "Unknown"),
            name=item.get("name", ""),
            full_type=item.get("full_type", ""),
        )
        for item in types
    ]


def _parse_field(node, kind: str) -> AttributeInfo:
    type_nodes = get_xml_elements(node, "./*[local-name()='Type']|./*[local-name()='TypeSet']")
    parsed_types: List[dict] = []
    for type_node in type_nodes:
        parsed_types.extend(parse_types_from_element(type_node))
    return AttributeInfo(
        name=get_xml_text(node, "./*[local-name()='Name']"),
        types=_to_refs(parsed_types),
        is_dimension=kind == "dimension",
        is_resource=kind == "resource",
    )


def _add_register_references(obj_info: ObjectInfo, attr: AttributeInfo, ref_kind: str) -> None:
    for type_ref in attr.types:
        if type_ref.obj_type in {"Primitive", "Unknown", "DefinedType"}:
            continue
        obj_info.references.append(
            ReferenceInfo(
                source_attribute=attr.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                ref_kind=ref_kind,
            )
        )


def parse_register(obj_info: ObjectInfo) -> None:
    """Parse register metadata XML and enrich object info."""
    for xml_file in iter_object_xml_candidates(obj_info):
        root = parse_xml_file(str(xml_file))
        if root is None:
            continue

        obj_info.synonym = obj_info.synonym or get_xml_text(
            root, ".//*[local-name()='Synonym']/*[local-name()='item']"
        )
        obj_info.comment = obj_info.comment or get_xml_text(root, ".//*[local-name()='Comment']")

        for dim_node in get_xml_elements(root, ".//*[local-name()='Dimensions']/*[local-name()='Dimension']"):
            dim = _parse_field(dim_node, "dimension")
            if not dim.name:
                continue
            obj_info.attributes.append(dim)
            _add_register_references(obj_info, dim, "dimension")

        for res_node in get_xml_elements(root, ".//*[local-name()='Resources']/*[local-name()='Resource']"):
            res = _parse_field(res_node, "resource")
            if not res.name:
                continue
            obj_info.attributes.append(res)
            _add_register_references(obj_info, res, "resource")

        for attr_node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
            attr = _parse_field(attr_node, "attribute")
            if not attr.name:
                continue
            obj_info.attributes.append(attr)
            _add_register_references(obj_info, attr, "attribute")

        # Измерение "Регистратор" как ссылка на документ
        registrar_nodes = get_xml_elements(root, ".//*[local-name()='Recorder']//*[local-name()='Type']")
        for node in registrar_nodes:
            for parsed in parse_types_from_element(node):
                if parsed.get("type") == "Document":
                    obj_info.references.append(
                        ReferenceInfo(
                            source_attribute="Recorder",
                            target_type="Document",
                            target_name=parsed.get("name", ""),
                            ref_kind="registrar",
                        )
                    )
        break


def parse_registers(objects: Dict[str, ObjectInfo]) -> None:
    """Parse all register objects."""
    for obj in objects.values():
        if obj.obj_type in REGISTER_TYPES:
            parse_register(obj)
