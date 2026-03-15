"""Парсер документов (Documents) — реквизиты, ТЧ, движения, ввод на основании."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, get_type_folder, NSMAP,
)


def parse_document(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Распарсить XML документа и заполнить ObjectInfo."""
    xml_path = _find_document_xml(config_path, obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    doc_el = _find_document_element(root)
    if doc_el is None:
        return obj_info

    obj_info.synonym = _get_property_text(doc_el, "Synonym")
    obj_info.comment = _get_property_text(doc_el, "Comment")

    _parse_movement_registers(doc_el, obj_info)
    _parse_based_on(doc_el, obj_info)
    _parse_attributes(doc_el, obj_info)
    _parse_tabular_sections(doc_el, obj_info)
    _parse_forms(doc_el, obj_info)
    _parse_templates(doc_el, obj_info)
    _parse_commands(doc_el, obj_info)

    posting = get_xml_text(doc_el, ".//md:Properties/md:Posting")
    if posting:
        obj_info.properties["Posting"] = posting

    number_type = get_xml_text(doc_el, ".//md:Properties/md:NumberType")
    if number_type:
        obj_info.properties["NumberType"] = number_type

    return obj_info


def _find_document_xml(config_path: str, name: str) -> Optional[str]:
    folder = get_type_folder("Document")
    candidates = [
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, folder, name, name + ".xml"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _find_document_element(root):
    for child in root:
        local = _local_tag(child.tag)
        if local == "Document":
            return child
    elems = get_xml_elements(root, ".//md:Document")
    return elems[0] if elems else root


def _get_property_text(element, prop_name: str) -> str:
    paths = [
        f".//md:Properties/md:{prop_name}/md:Value",
        f".//md:Properties/md:{prop_name}",
        f".//{prop_name}",
    ]
    for p in paths:
        val = get_xml_text(element, p)
        if val:
            return val
    v8_paths = [
        f".//md:Properties/md:{prop_name}//v8:item/v8:content",
        f".//md:{prop_name}//v8:item/v8:content",
    ]
    for p in v8_paths:
        val = get_xml_text(element, p)
        if val:
            return val
    return ""


def _parse_movement_registers(element, obj_info: ObjectInfo):
    """Парсинг регистров движений документа."""
    reg_paths = [
        ".//md:Properties/md:RegisterRecords/md:Item",
        ".//md:RegisterRecords/xr:Item",
        ".//md:RegisterRecords/md:Item",
    ]
    for path in reg_paths:
        reg_elems = get_xml_elements(element, path)
        if reg_elems:
            break

    for re_elem in reg_elems:
        text = (re_elem.text or "").strip()
        if text:
            obj_info.movement_registers.append(text)
            parts = text.split(".")
            if len(parts) >= 2:
                obj_info.references.append(ReferenceInfo(
                    source_attribute="RegisterRecords",
                    target_type=parts[0],
                    target_name=parts[1],
                    ref_kind="attribute",
                ))


def _parse_based_on(element, obj_info: ObjectInfo):
    based_on_paths = [
        ".//md:Properties/md:BasedOn/md:Item",
        ".//md:BasedOn/xr:Item",
        ".//md:BasedOn/md:Item",
    ]
    for path in based_on_paths:
        elems = get_xml_elements(element, path)
        if elems:
            break

    for be in elems:
        text = (be.text or "").strip()
        if text:
            obj_info.based_on.append(text)
            parts = text.split(".")
            if len(parts) >= 2:
                obj_info.references.append(ReferenceInfo(
                    source_attribute="BasedOn",
                    target_type=parts[0],
                    target_name=parts[1],
                    ref_kind="based_on",
                ))


def _parse_attributes(element, obj_info: ObjectInfo):
    attr_elems = get_xml_elements(element, ".//md:ChildObjects/md:Attribute")
    if not attr_elems:
        attr_elems = get_xml_elements(element, ".//md:Attributes")

    for ae in attr_elems:
        attr_info = _parse_single_attribute(ae)
        if attr_info:
            obj_info.attributes.append(attr_info)
            _extract_references(attr_info, obj_info)


def _parse_tabular_sections(element, obj_info: ObjectInfo):
    ts_elems = get_xml_elements(element, ".//md:ChildObjects/md:TabularSection")
    if not ts_elems:
        ts_elems = get_xml_elements(element, ".//md:TabularSections")

    for ts_el in ts_elems:
        ts_name = _get_child_object_name(ts_el)
        if not ts_name:
            continue

        ts_info = TabularSectionInfo(name=ts_name)

        ts_attr_elems = get_xml_elements(ts_el, ".//md:Attribute")
        if not ts_attr_elems:
            ts_attr_elems = get_xml_elements(ts_el, ".//md:ChildObjects/md:Attribute")

        for tsa in ts_attr_elems:
            attr_info = _parse_single_attribute(tsa, tabular_section=ts_name)
            if attr_info:
                ts_info.attributes.append(attr_info)
                _extract_references(attr_info, obj_info)

        obj_info.tabular_sections.append(ts_info)


def _parse_forms(element, obj_info: ObjectInfo):
    for fe in get_xml_elements(element, ".//md:ChildObjects/md:Form"):
        name = (fe.text or "").strip()
        if name:
            obj_info.forms.append(name)


def _parse_templates(element, obj_info: ObjectInfo):
    for te in get_xml_elements(element, ".//md:ChildObjects/md:Template"):
        name = (te.text or "").strip()
        if name:
            obj_info.templates.append(name)


def _parse_commands(element, obj_info: ObjectInfo):
    for ce in get_xml_elements(element, ".//md:ChildObjects/md:Command"):
        name = (ce.text or "").strip()
        if name:
            obj_info.commands.append(name)


def _parse_single_attribute(attr_element, tabular_section: str = "") -> Optional[AttributeInfo]:
    name = _get_child_object_name(attr_element)
    if not name:
        name = get_xml_text(attr_element, ".//md:Properties/md:Name")
    if not name:
        return None

    type_refs: List[TypeRef] = []
    type_container = get_xml_elements(attr_element, ".//md:Properties/md:Type")
    if not type_container:
        type_container = get_xml_elements(attr_element, ".//md:Type")

    if type_container:
        parsed_types = parse_types_from_element(type_container[0])
        for pt in parsed_types:
            type_refs.append(TypeRef(
                obj_type=pt["type"],
                name=pt["name"],
                full_type=pt["full_type"],
            ))

    return AttributeInfo(
        name=name,
        types=type_refs,
        tabular_section=tabular_section,
    )


def _extract_references(attr_info: AttributeInfo, obj_info: ObjectInfo):
    ref_types = {"Catalog", "Document", "Enum", "ChartOfCharacteristicTypes",
                 "ChartOfAccounts", "ChartOfCalculationTypes", "BusinessProcess",
                 "Task", "ExchangePlan"}
    for tr in attr_info.types:
        if tr.obj_type in ref_types:
            obj_info.references.append(ReferenceInfo(
                source_attribute=attr_info.name,
                target_type=tr.obj_type,
                target_name=tr.name,
                tabular_section=attr_info.tabular_section,
                ref_kind="attribute",
            ))


def _get_child_object_name(element) -> str:
    name = element.get("name", "") or element.get("Name", "")
    if name:
        return name.strip()
    name = get_xml_text(element, ".//md:Properties/md:Name")
    if name:
        return name
    if element.text and element.text.strip():
        return element.text.strip()
    return ""


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
