"""Парсер регистров: сведений, накопления, бухгалтерии, расчёта."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, parse_types_from_element, parse_type_value,
    get_full_object_key,
)
from scanner import get_object_xml_path


_REGISTER_TYPES = [
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
]


def parse_registers(graph: DependencyGraph, config_path: str):
    """Parse all register objects in the graph."""
    for reg_type in _REGISTER_TYPES:
        registers = graph.get_objects_by_type(reg_type)
        for obj in registers:
            _parse_single_register(obj, graph, config_path)


def _parse_single_register(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Parse a single register XML."""
    xml_path = get_object_xml_path(obj)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    _parse_register_properties(obj, root)
    _parse_register_dimensions(obj, root, graph)
    _parse_register_resources(obj, root, graph)
    _parse_register_attributes(obj, root, graph)
    _parse_register_recorder(obj, root, graph)
    _parse_register_forms(obj, root)


def _parse_register_properties(obj: ObjectInfo, root):
    """Extract register-specific properties."""
    obj.synonym = _find_property_text(root, "Synonym")
    obj.comment = _find_property_text(root, "Comment")

    type_specific = {
        "InformationRegister": ["InformationRegisterPeriodicity", "WriteMode", "MainFilterOnPeriod"],
        "AccumulationRegister": ["RegisterType"],
        "AccountingRegister": ["ChartOfAccounts", "Correspondence"],
        "CalculationRegister": ["Schedule", "ScheduleDate", "ActualPeriod"],
    }

    for prop in type_specific.get(obj.obj_type, []):
        val = _find_property_text(root, prop)
        if val:
            obj.properties[prop] = val


def _parse_register_dimensions(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse register dimensions (измерения)."""
    dims = _find_elements_by_local(root, "Dimension")
    for dim_elem in dims:
        dim_name = _get_child_text(dim_elem, "Name")
        if not dim_name:
            continue

        type_refs = _extract_type_refs(dim_elem)
        attr = AttributeInfo(
            name=dim_name,
            types=type_refs,
            is_dimension=True,
        )
        obj.attributes.append(attr)

        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute=dim_name,
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="dimension",
            )
            obj.references.append(ref)
            _add_register_edge(graph, obj, tr)


def _parse_register_resources(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse register resources (ресурсы)."""
    resources = _find_elements_by_local(root, "Resource")
    for res_elem in resources:
        res_name = _get_child_text(res_elem, "Name")
        if not res_name:
            continue

        type_refs = _extract_type_refs(res_elem)
        attr = AttributeInfo(
            name=res_name,
            types=type_refs,
            is_resource=True,
        )
        obj.attributes.append(attr)

        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute=res_name,
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="resource",
            )
            obj.references.append(ref)
            _add_register_edge(graph, obj, tr)


def _parse_register_attributes(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse register attributes (реквизиты)."""
    attrs = _find_elements_by_local(root, "Attribute")
    for attr_elem in attrs:
        attr_name = _get_child_text(attr_elem, "Name")
        if not attr_name:
            continue

        if any(a.name == attr_name for a in obj.attributes):
            continue

        type_refs = _extract_type_refs(attr_elem)
        attr = AttributeInfo(name=attr_name, types=type_refs)
        obj.attributes.append(attr)

        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute=attr_name,
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="attribute",
            )
            obj.references.append(ref)
            _add_register_edge(graph, obj, tr)


def _parse_register_recorder(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse recorder (регистратор) reference — creates reverse edge."""
    recorders = _find_elements_by_local(root, "Recorder")
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for rec_elem in recorders:
        for child in rec_elem:
            text = (child.text or "").strip()
            if text:
                ref = parse_type_value(text)
                if ref and ref.obj_type == "Document":
                    target_key = get_full_object_key(ref.obj_type, ref.name)
                    graph.add_edge(Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.REGISTER_TO_DOCUMENT,
                        meta={"recorder": text},
                    ))


def _parse_register_forms(obj: ObjectInfo, root):
    """Parse form references."""
    form_elements = _find_elements_by_local(root, "Form")
    for fe in form_elements:
        name = _get_child_text(fe, "Name") or (fe.text or "").strip()
        if name:
            obj.forms.append(name)


def _add_register_edge(graph: DependencyGraph, obj: ObjectInfo, tr: TypeRef):
    """Add an appropriate edge from a register to a referenced type."""
    source_key = get_full_object_key(obj.obj_type, obj.name)
    target_key = get_full_object_key(tr.obj_type, tr.name)

    if tr.obj_type == "Catalog":
        kind = EdgeKind.REGISTER_TO_CATALOG
    elif tr.obj_type == "Document":
        kind = EdgeKind.REGISTER_TO_DOCUMENT
    elif tr.obj_type in ("InformationRegister", "AccumulationRegister",
                         "AccountingRegister", "CalculationRegister"):
        kind = EdgeKind.REGISTER_TO_REGISTER
    else:
        kind = EdgeKind.REGISTER_TO_CATALOG

    graph.add_edge(Edge(source=source_key, target=target_key, kind=kind))


def _find_elements_by_local(root, local_name: str) -> list:
    result = []
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            result.append(elem)
    return result


def _get_child_text(elem, child_local_name: str) -> str:
    for child in elem:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == child_local_name:
            return (child.text or "").strip()
    return ""


def _find_property_text(root, prop_name: str) -> str:
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == prop_name:
            if elem.text:
                return elem.text.strip()
            for child in elem:
                child_tag = child.tag
                if "}" in child_tag:
                    child_tag = child_tag.split("}", 1)[1]
                if child_tag in ("v", "Content"):
                    return (child.text or "").strip()
    return ""


def _extract_type_refs(attr_elem) -> list:
    type_elems = _find_elements_by_local(attr_elem, "Type")
    results = []
    for te in type_elems:
        refs = parse_types_from_element(te)
        results.extend(refs)
    if not results:
        refs = parse_types_from_element(attr_elem)
        results.extend(refs)
    return results
