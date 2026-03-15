"""Парсер документов (Document) — реквизиты, табличные части, движения, ввод на основании."""

import os
from typing import List

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, parse_type_value,
    get_full_object_key,
)
from scanner import get_object_xml_path


def parse_documents(graph: DependencyGraph, config_path: str):
    """Parse all Document objects in the graph."""
    documents = graph.get_objects_by_type("Document")
    for obj in documents:
        _parse_single_document(obj, graph, config_path)


def _parse_single_document(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Parse a single document XML and populate ObjectInfo."""
    xml_path = get_object_xml_path(obj)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    _parse_document_properties(obj, root)
    _parse_document_attributes(obj, root, graph)
    _parse_document_tabular_sections(obj, root, graph)
    _parse_document_registers(obj, root, graph)
    _parse_document_based_on(obj, root, graph)
    _parse_document_forms(obj, root)
    _parse_document_commands(obj, root)
    _parse_document_templates(obj, root)


def _parse_document_properties(obj: ObjectInfo, root):
    """Extract synonym, comment, and basic properties."""
    obj.synonym = _find_property_text(root, "Synonym")
    obj.comment = _find_property_text(root, "Comment")

    props = ["NumberType", "NumberLength", "Posting", "RealTimePosting",
             "RegisterRecords", "AutomaticDeletion"]
    for prop in props:
        val = _find_property_text(root, prop)
        if val:
            obj.properties[prop] = val


def _parse_document_attributes(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse document attributes and extract type references."""
    attrs = _find_elements_by_local(root, "Attribute")
    for attr_elem in attrs:
        attr_name = _get_child_text(attr_elem, "Name")
        if not attr_name:
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
            _add_doc_reference_edge(graph, obj, tr)


def _parse_document_tabular_sections(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse tabular sections and their attributes."""
    ts_elements = _find_elements_by_local(root, "TabularSection")
    for ts_elem in ts_elements:
        ts_name = _get_child_text(ts_elem, "Name")
        if not ts_name:
            continue

        ts_info = TabularSectionInfo(name=ts_name)

        ts_attrs = _find_elements_by_local(ts_elem, "Attribute")
        for attr_elem in ts_attrs:
            attr_name = _get_child_text(attr_elem, "Name")
            if not attr_name:
                continue

            type_refs = _extract_type_refs(attr_elem)
            attr = AttributeInfo(
                name=attr_name,
                types=type_refs,
                tabular_section=ts_name,
            )
            ts_info.attributes.append(attr)

            for tr in type_refs:
                ref = ReferenceInfo(
                    source_attribute=attr_name,
                    target_type=tr.obj_type,
                    target_name=tr.name,
                    tabular_section=ts_name,
                    ref_kind="attribute",
                )
                obj.references.append(ref)
                _add_doc_reference_edge(graph, obj, tr)

        obj.tabular_sections.append(ts_info)


def _parse_document_registers(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse register records (движения) — RegisterRecords section."""
    reg_elements = _find_elements_by_local(root, "RegisterRecords")
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for re_container in reg_elements:
        for child in re_container:
            reg_text = (child.text or "").strip()
            if not reg_text:
                continue

            obj.movement_registers.append(reg_text)
            reg_type, reg_name = _parse_register_ref(reg_text)
            if reg_type and reg_name:
                target_key = get_full_object_key(reg_type, reg_name)
                graph.add_edge(Edge(
                    source=source_key,
                    target=target_key,
                    kind=EdgeKind.DOC_TO_REGISTER,
                    meta={"register": reg_text},
                ))

    if not obj.movement_registers:
        for elem in root.iter():
            tag = _strip_ns(elem.tag)
            if tag in ("RegisterRecordName", "Record", "RegisterRecord"):
                text = (elem.text or "").strip()
                if text:
                    obj.movement_registers.append(text)
                    reg_type, reg_name = _parse_register_ref(text)
                    if reg_type and reg_name:
                        target_key = get_full_object_key(reg_type, reg_name)
                        graph.add_edge(Edge(
                            source=source_key,
                            target=target_key,
                            kind=EdgeKind.DOC_TO_REGISTER,
                            meta={"register": text},
                        ))


def _parse_document_based_on(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse 'input on basis' (ввод на основании) references."""
    based_on_elements = _find_elements_by_local(root, "BasedOn")
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for bo_elem in based_on_elements:
        for child in bo_elem:
            text = (child.text or "").strip()
            if text:
                obj.based_on.append(text)
                ref = parse_type_value(text)
                if ref:
                    target_key = get_full_object_key(ref.obj_type, ref.name)
                    graph.add_edge(Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.BASED_ON,
                        meta={"based_on": text},
                    ))

    if not obj.based_on:
        for elem in root.iter():
            tag = _strip_ns(elem.tag)
            if tag == "InputByString" or tag == "BasedOn":
                continue
            if tag in ("InputOnBasisDocument", "InputOnBasis", "Basis"):
                text = (elem.text or "").strip()
                if text:
                    obj.based_on.append(text)


def _parse_document_forms(obj: ObjectInfo, root):
    form_elements = _find_elements_by_local(root, "Form")
    for fe in form_elements:
        name = _get_child_text(fe, "Name") or (fe.text or "").strip()
        if name:
            obj.forms.append(name)


def _parse_document_commands(obj: ObjectInfo, root):
    cmd_elements = _find_elements_by_local(root, "Command")
    for ce in cmd_elements:
        name = _get_child_text(ce, "Name") or (ce.text or "").strip()
        if name:
            obj.commands.append(name)


def _parse_document_templates(obj: ObjectInfo, root):
    tpl_elements = _find_elements_by_local(root, "Template")
    for te in tpl_elements:
        name = _get_child_text(te, "Name") or (te.text or "").strip()
        if name:
            obj.templates.append(name)


def _add_doc_reference_edge(graph: DependencyGraph, obj: ObjectInfo, tr: TypeRef):
    """Add appropriate edge from a document to a referenced type."""
    source_key = get_full_object_key(obj.obj_type, obj.name)
    target_key = get_full_object_key(tr.obj_type, tr.name)

    if tr.obj_type == "Catalog":
        kind = EdgeKind.DOC_TO_CATALOG
    elif tr.obj_type == "Document":
        kind = EdgeKind.DOC_TO_DOCUMENT
    else:
        kind = EdgeKind.DOC_TO_CATALOG

    graph.add_edge(Edge(source=source_key, target=target_key, kind=kind))


def _parse_register_ref(text: str) -> tuple:
    """Parse register reference like 'AccumulationRegister.ТоварыНаСкладах'."""
    register_types = {
        "AccumulationRegister", "InformationRegister",
        "AccountingRegister", "CalculationRegister",
    }

    parts = text.split(".", 1)
    if len(parts) == 2 and parts[0] in register_types:
        return parts[0], parts[1]

    for rt in register_types:
        if text.startswith(rt):
            name = text[len(rt):]
            if name.startswith("."):
                name = name[1:]
            if name:
                return rt, name

    return "", ""


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


def _strip_ns(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
