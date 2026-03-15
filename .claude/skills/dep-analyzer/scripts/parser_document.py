"""Парсер документов (Documents): реквизиты, ТЧ, движения по регистрам, ввод на основании."""
import os
from typing import List, Optional

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements, parse_types_from_element,
    get_full_object_key, _detect_nsmap, NSMAP,
)


def parse_documents(graph: DependencyGraph, config_path: str):
    """Разобрать все документы и заполнить ObjectInfo + добавить рёбра."""
    for key, obj in list(graph.objects.items()):
        if obj.obj_type != "Document":
            continue
        _parse_one_document(obj, graph, config_path)


def _parse_one_document(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    xml_path = os.path.join(obj.path, f"{obj.name}.xml") if obj.path else None
    if not xml_path or not os.path.exists(xml_path):
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    doc_el = _find_document_element(root, obj.name, nsmap)
    if doc_el is None:
        return

    _parse_properties(doc_el, obj, nsmap)
    _parse_registers(doc_el, obj, graph, nsmap)
    _parse_attributes(doc_el, obj, graph, nsmap)
    _parse_tabular_sections(doc_el, obj, graph, nsmap)
    _parse_forms_templates_commands(doc_el, obj, nsmap)
    _parse_based_on(doc_el, obj, graph, nsmap)


def _find_document_element(root, name: str, nsmap: dict):
    els = get_xml_elements(root, ".//md:Document", nsmap)
    if els:
        return els[0]
    for child in root:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "Document":
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


def _parse_registers(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    """Извлечь регистры движений документа."""
    for reg_el in get_xml_elements(el, ".//md:Properties/md:RegisterRecords/xr:Item", nsmap):
        text = reg_el.text
        if not text:
            continue
        text = text.strip()
        obj.movement_registers.append(text)

        parts = text.split(".")
        if len(parts) >= 2:
            reg_type = parts[0]
            reg_name = parts[1]
            graph.add_edge(Edge(
                source=get_full_object_key(obj.obj_type, obj.name),
                target=get_full_object_key(reg_type, reg_name),
                kind=EdgeKind.DOC_TO_REGISTER,
                meta={"relation": "movement"},
            ))

    if not obj.movement_registers:
        for reg_el in get_xml_elements(el, ".//md:Properties/md:RegisterRecords/*", nsmap):
            text = reg_el.text
            if text and text.strip():
                text = text.strip()
                obj.movement_registers.append(text)
                parts = text.split(".")
                if len(parts) >= 2:
                    graph.add_edge(Edge(
                        source=get_full_object_key(obj.obj_type, obj.name),
                        target=get_full_object_key(parts[0], parts[1]),
                        kind=EdgeKind.DOC_TO_REGISTER,
                        meta={"relation": "movement"},
                    ))


def _parse_attributes(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
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
                _add_attribute_edge(obj, attr_name, tr, graph, "")

        obj.attributes.append(attr_info)


def _parse_tabular_sections(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    for ts_el in get_xml_elements(el, ".//md:ChildObjects/md:TabularSection", nsmap):
        ts_name = get_xml_text(ts_el, ".//md:Properties/md:Name", "", nsmap)
        if not ts_name:
            ts_name = ts_el.get("name", "")
        if not ts_name:
            continue

        ts_info = TabularSectionInfo(name=ts_name)

        for attr_el in get_xml_elements(ts_el, ".//md:ChildObjects/md:Attribute", nsmap):
            attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", "", nsmap)
            if not attr_name:
                attr_name = attr_el.get("name", "")
            if not attr_name:
                continue

            attr_info = AttributeInfo(name=attr_name, tabular_section=ts_name)
            type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
            if type_container:
                type_refs = parse_types_from_element(type_container[0])
                for tr in type_refs:
                    attr_info.types.append(TypeRef(
                        obj_type=tr["type"], name=tr["name"], full_type=tr["full_type"]
                    ))
                    _add_attribute_edge(obj, attr_name, tr, graph, ts_name)

            ts_info.attributes.append(attr_info)

        obj.tabular_sections.append(ts_info)


def _parse_forms_templates_commands(el, obj: ObjectInfo, nsmap: dict):
    for form_el in get_xml_elements(el, ".//md:ChildObjects/md:Form", nsmap):
        name = form_el.text.strip() if form_el.text else ""
        if name:
            obj.forms.append(name)

    for tmpl_el in get_xml_elements(el, ".//md:ChildObjects/md:Template", nsmap):
        name = tmpl_el.text.strip() if tmpl_el.text else ""
        if name:
            obj.templates.append(name)

    for cmd_el in get_xml_elements(el, ".//md:ChildObjects/md:Command", nsmap):
        name = cmd_el.text.strip() if cmd_el.text else ""
        if name:
            obj.commands.append(name)


def _parse_based_on(el, obj: ObjectInfo, graph: DependencyGraph, nsmap: dict):
    for bo_el in get_xml_elements(el, ".//md:Properties/md:BasedOn/xr:Item", nsmap):
        text = bo_el.text
        if not text:
            continue
        text = text.strip()
        parts = text.split(".")
        if len(parts) >= 2:
            ref = ReferenceInfo(
                source_attribute="BasedOn",
                target_type=parts[0],
                target_name=parts[1],
                ref_kind="based_on",
            )
            obj.references.append(ref)
            obj.based_on.append(text)
            graph.add_edge(Edge(
                source=get_full_object_key(obj.obj_type, obj.name),
                target=get_full_object_key(parts[0], parts[1]),
                kind=EdgeKind.BASED_ON,
            ))


def _add_attribute_edge(obj: ObjectInfo, attr_name: str, type_ref: dict,
                        graph: DependencyGraph, ts_name: str):
    target_type = type_ref["type"]
    target_name = type_ref["name"]

    if target_type in ("DefinedType",):
        return

    ref = ReferenceInfo(
        source_attribute=attr_name,
        target_type=target_type,
        target_name=target_name,
        tabular_section=ts_name,
        ref_kind="attribute",
    )
    obj.references.append(ref)

    kind = _determine_edge_kind(target_type)
    graph.add_edge(Edge(
        source=get_full_object_key(obj.obj_type, obj.name),
        target=get_full_object_key(target_type, target_name),
        kind=kind,
        meta={"attribute": attr_name, "tabular_section": ts_name},
    ))


def _determine_edge_kind(target_type: str) -> EdgeKind:
    if target_type == "Catalog":
        return EdgeKind.DOC_TO_CATALOG
    if target_type == "Document":
        return EdgeKind.DOC_TO_DOCUMENT
    return EdgeKind.DOC_TO_CATALOG
