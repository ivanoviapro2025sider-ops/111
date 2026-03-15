"""Парсер регистров: сведений, накопления, бухгалтерии, расчёта."""
import os
from typing import List

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements, parse_types_from_element,
    get_full_object_key, _detect_nsmap, NSMAP,
)

_REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}

_REGISTER_TAG_MAP = {
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
}


def parse_registers(graph: DependencyGraph, config_path: str):
    """Разобрать все регистры."""
    for key, obj in list(graph.objects.items()):
        if obj.obj_type in _REGISTER_TYPES:
            _parse_one_register(obj, graph, config_path)


def _parse_one_register(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    xml_path = os.path.join(obj.path, f"{obj.name}.xml") if obj.path else None
    if not xml_path or not os.path.exists(xml_path):
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    reg_el = _find_register_element(root, obj.obj_type, nsmap)
    if reg_el is None:
        return

    _parse_properties(reg_el, obj, nsmap)
    _parse_recorder(reg_el, obj, graph, nsmap)
    _parse_dimensions(reg_el, obj, graph, nsmap)
    _parse_resources(reg_el, obj, graph, nsmap)
    _parse_attributes_reg(reg_el, obj, graph, nsmap)


def _find_register_element(root, obj_type: str, nsmap: dict):
    tag = _REGISTER_TAG_MAP.get(obj_type, obj_type)
    els = get_xml_elements(root, f".//md:{tag}", nsmap)
    if els:
        return els[0]
    for child in root:
        local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if local == tag:
            return child
    return root


def _parse_properties(el, obj: ObjectInfo, nsmap: dict):
    obj.synonym = get_xml_text(el, ".//md:Properties/md:Synonym/v8:item/v8:content", "", nsmap)
    if not obj.synonym:
        obj.synonym = get_xml_text(el, ".//md:Properties/md:Synonym", "", nsmap)
    obj.comment = get_xml_text(el, ".//md:Properties/md:Comment", "", nsmap)

    for prop_el in get_xml_elements(el, ".//md:Properties/*", nsmap):
        tag = prop_el.tag.split("}")[-1] if "}" in prop_el.tag else prop_el.tag
        val = prop_el.text
        if val and val.strip():
            obj.properties[tag] = val.strip()


def _parse_recorder(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    """Извлечь документы-регистраторы (обратная связь register→document)."""
    for rec_el in get_xml_elements(el, ".//md:Properties/md:RegisterRecords/xr:Item", nsmap):
        text = rec_el.text
        if text and text.strip():
            text = text.strip()
            parts = text.split(".")
            if len(parts) >= 2 and parts[0] == "Document":
                graph.add_edge(Edge(
                    source=get_full_object_key(obj.obj_type, obj.name),
                    target=get_full_object_key("Document", parts[1]),
                    kind=EdgeKind.REGISTER_TO_DOCUMENT,
                    meta={"relation": "recorder"},
                ))


def _parse_dimensions(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    """Парсинг измерений регистра."""
    for dim_el in get_xml_elements(el, ".//md:ChildObjects/md:Dimension", nsmap):
        dim_name = get_xml_text(dim_el, ".//md:Properties/md:Name", "", nsmap)
        if not dim_name:
            dim_name = dim_el.get("name", "")
        if not dim_name:
            continue

        attr_info = AttributeInfo(name=dim_name, is_dimension=True)
        type_container = get_xml_elements(dim_el, ".//md:Properties/md:Type", nsmap)
        if type_container:
            type_refs = parse_types_from_element(type_container[0])
            for tr in type_refs:
                attr_info.types.append(TypeRef(
                    obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                ))
                _add_register_ref(obj, dim_name, tr, graph, "dimension")

        obj.attributes.append(attr_info)


def _parse_resources(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    """Парсинг ресурсов регистра."""
    for res_el in get_xml_elements(el, ".//md:ChildObjects/md:Resource", nsmap):
        res_name = get_xml_text(res_el, ".//md:Properties/md:Name", "", nsmap)
        if not res_name:
            res_name = res_el.get("name", "")
        if not res_name:
            continue

        attr_info = AttributeInfo(name=res_name, is_resource=True)
        type_container = get_xml_elements(res_el, ".//md:Properties/md:Type", nsmap)
        if type_container:
            type_refs = parse_types_from_element(type_container[0])
            for tr in type_refs:
                attr_info.types.append(TypeRef(
                    obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                ))
                _add_register_ref(obj, res_name, tr, graph, "resource")

        obj.attributes.append(attr_info)


def _parse_attributes_reg(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    """Парсинг реквизитов регистра (не измерения и не ресурсы)."""
    for attr_el in get_xml_elements(el, ".//md:ChildObjects/md:Attribute", nsmap):
        attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", "", nsmap)
        if not attr_name:
            attr_name = attr_el.get("name", "")
        if not attr_name:
            continue

        attr_info = AttributeInfo(name=attr_name)
        type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
        if type_container:
            type_refs = parse_types_from_element(type_container[0])
            for tr in type_refs:
                attr_info.types.append(TypeRef(
                    obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                ))
                _add_register_ref(obj, attr_name, tr, graph, "attribute")

        obj.attributes.append(attr_info)


def _add_register_ref(obj: ObjectInfo, attr_name: str, type_ref: dict,
                      graph: DependencyGraph, ref_kind: str):
    target_type = type_ref["type"]
    target_name = type_ref["name"]

    if target_type in ("DefinedType",):
        return

    ref = ReferenceInfo(
        source_attribute=attr_name,
        target_type=target_type,
        target_name=target_name,
        ref_kind=ref_kind,
    )
    obj.references.append(ref)

    edge_kind = _determine_register_edge_kind(obj.obj_type, target_type)
    graph.add_edge(Edge(
        source=get_full_object_key(obj.obj_type, obj.name),
        target=get_full_object_key(target_type, target_name),
        kind=edge_kind,
        meta={"attribute": attr_name, "ref_kind": ref_kind},
    ))


def _determine_register_edge_kind(source_type: str, target_type: str) -> EdgeKind:
    if target_type == "Document":
        return EdgeKind.REGISTER_TO_DOCUMENT
    if target_type == "Catalog":
        return EdgeKind.REGISTER_TO_CATALOG
    if target_type in _REGISTER_TYPES:
        return EdgeKind.REGISTER_TO_REGISTER
    return EdgeKind.REGISTER_TO_CATALOG
