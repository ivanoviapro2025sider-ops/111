"""Parser for Catalog metadata objects."""

from __future__ import annotations

from typing import Dict, List

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from scanner import iter_object_xml_candidates
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


def _types_to_refs(parsed_types: List[dict]) -> List[TypeRef]:
    refs: List[TypeRef] = []
    for item in parsed_types:
        refs.append(
            TypeRef(
                obj_type=item.get("type", "Unknown"),
                name=item.get("name", ""),
                full_type=item.get("full_type", ""),
            )
        )
    return refs


def _extract_attribute(attr_node, tabular_section: str = "") -> AttributeInfo:
    attr_name = get_xml_text(attr_node, "./*[local-name()='Name']")
    type_nodes = get_xml_elements(attr_node, "./*[local-name()='Type']|./*[local-name()='TypeSet']")
    parsed_types: List[dict] = []
    for type_node in type_nodes:
        parsed_types.extend(parse_types_from_element(type_node))
    return AttributeInfo(
        name=attr_name,
        types=_types_to_refs(parsed_types),
        tabular_section=tabular_section,
    )


def _append_references(target: ObjectInfo, attr: AttributeInfo, ref_kind: str = "attribute") -> None:
    for type_ref in attr.types:
        if type_ref.obj_type in {"Primitive", "Unknown", "DefinedType"}:
            continue
        target.references.append(
            ReferenceInfo(
                source_attribute=attr.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attr.tabular_section,
                ref_kind=ref_kind,
            )
        )


def parse_catalog(obj_info: ObjectInfo) -> None:
    """Parse single catalog metadata XML and enrich object info."""
    for xml_file in iter_object_xml_candidates(obj_info):
        root = parse_xml_file(str(xml_file))
        if root is None:
            continue

        obj_info.synonym = obj_info.synonym or get_xml_text(
            root, ".//*[local-name()='Synonym']/*[local-name()='item']"
        )
        obj_info.comment = obj_info.comment or get_xml_text(root, ".//*[local-name()='Comment']")

        attr_nodes = get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']")
        for attr_node in attr_nodes:
            attr = _extract_attribute(attr_node)
            if attr.name:
                obj_info.attributes.append(attr)
                _append_references(obj_info, attr)

        ts_nodes = get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']")
        for ts_node in ts_nodes:
            ts_name = get_xml_text(ts_node, "./*[local-name()='Name']")
            ts_info = TabularSectionInfo(name=ts_name)
            ts_attrs = get_xml_elements(ts_node, ".//*[local-name()='Attribute']")
            for ts_attr_node in ts_attrs:
                attr = _extract_attribute(ts_attr_node, tabular_section=ts_name)
                if attr.name:
                    ts_info.attributes.append(attr)
                    _append_references(obj_info, attr)
            if ts_info.name or ts_info.attributes:
                obj_info.tabular_sections.append(ts_info)

        owner_nodes = get_xml_elements(root, ".//*[local-name()='Owners']//*[local-name()='Type']")
        for owner_node in owner_nodes:
            for parsed in parse_types_from_element(owner_node):
                if parsed.get("type") == "Catalog":
                    obj_info.references.append(
                        ReferenceInfo(
                            source_attribute="Owner",
                            target_type="Catalog",
                            target_name=parsed.get("name", ""),
                            ref_kind="owner",
                        )
                    )

        is_hierarchical = get_xml_text(root, ".//*[local-name()='Hierarchical']").lower() == "true"
        if is_hierarchical:
            obj_info.references.append(
                ReferenceInfo(
                    source_attribute="Parent",
                    target_type="Catalog",
                    target_name=obj_info.name,
                    ref_kind="hierarchy",
                )
            )
        break


def parse_catalogs(objects: Dict[str, ObjectInfo]) -> None:
    """Parse all catalogs from indexed metadata objects."""
    for obj in objects.values():
        if obj.obj_type == "Catalog":
            parse_catalog(obj)
