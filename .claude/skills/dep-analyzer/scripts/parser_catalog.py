"""Парсер справочников (Catalogs) — извлечение реквизитов, ТЧ, иерархии, владельцев."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, get_type_folder, NSMAP,
)


def parse_catalog(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Распарсить XML справочника и заполнить ObjectInfo."""
    xml_path = _find_catalog_xml(config_path, obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    catalog_el = _find_catalog_element(root)
    if catalog_el is None:
        return obj_info

    obj_info.synonym = _get_property_text(catalog_el, "Synonym")
    obj_info.comment = _get_property_text(catalog_el, "Comment")

    _parse_owners(catalog_el, obj_info)
    _parse_hierarchy(catalog_el, obj_info)
    _parse_based_on(catalog_el, obj_info)
    _parse_attributes(catalog_el, obj_info)
    _parse_tabular_sections(catalog_el, obj_info)
    _parse_forms(catalog_el, obj_info)
    _parse_templates(catalog_el, obj_info)
    _parse_commands(catalog_el, obj_info)

    return obj_info


def _find_catalog_xml(config_path: str, name: str) -> Optional[str]:
    folder = get_type_folder("Catalog")
    candidates = [
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, folder, name, name + ".xml"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _find_catalog_element(root):
    """Найти элемент Catalog внутри корня XML."""
    for child in root:
        local = _local_tag(child.tag)
        if local == "Catalog":
            return child

    elems = get_xml_elements(root, ".//md:Catalog")
    return elems[0] if elems else root


def _get_property_text(element, prop_name: str) -> str:
    """Извлечь текст свойства из Properties/prop_name/v8:item/v8:content."""
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


def _parse_owners(element, obj_info: ObjectInfo):
    """Парсинг владельцев справочника."""
    owner_elems = get_xml_elements(element, ".//md:Properties/md:Owners/md:Item")
    if not owner_elems:
        owner_elems = get_xml_elements(element, ".//md:Owners/xr:Item")
    if not owner_elems:
        owner_elems = get_xml_elements(element, ".//md:Owners/md:Item")

    for oe in owner_elems:
        text = (oe.text or "").strip()
        if text:
            parts = text.split(".")
            if len(parts) >= 2:
                obj_info.references.append(ReferenceInfo(
                    source_attribute="Owner",
                    target_type=parts[0],
                    target_name=parts[1],
                    ref_kind="owner",
                ))
            else:
                obj_info.references.append(ReferenceInfo(
                    source_attribute="Owner",
                    target_type="Catalog",
                    target_name=text,
                    ref_kind="owner",
                ))


def _parse_hierarchy(element, obj_info: ObjectInfo):
    """Парсинг иерархии справочника."""
    hierarchical = get_xml_text(element, ".//md:Properties/md:Hierarchical")
    if hierarchical.lower() in ("true", "1"):
        obj_info.properties["Hierarchical"] = "true"
        hierarchy_type = get_xml_text(
            element, ".//md:Properties/md:HierarchyType", default="HierarchyFoldersAndItems"
        )
        obj_info.properties["HierarchyType"] = hierarchy_type


def _parse_based_on(element, obj_info: ObjectInfo):
    """Парсинг «Ввод на основании»."""
    based_on_elems = get_xml_elements(element, ".//md:Properties/md:BasedOn/md:Item")
    if not based_on_elems:
        based_on_elems = get_xml_elements(element, ".//md:BasedOn/xr:Item")

    for be in based_on_elems:
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
    """Парсинг реквизитов справочника."""
    attr_elems = get_xml_elements(element, ".//md:ChildObjects/md:Attribute")
    if not attr_elems:
        attr_elems = get_xml_elements(element, ".//md:Attributes")

    for ae in attr_elems:
        attr_info = _parse_single_attribute(ae)
        if attr_info:
            obj_info.attributes.append(attr_info)
            _extract_references(attr_info, obj_info, "Catalog")


def _parse_tabular_sections(element, obj_info: ObjectInfo):
    """Парсинг табличных частей."""
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
                _extract_references(attr_info, obj_info, "Catalog")

        obj_info.tabular_sections.append(ts_info)


def _parse_forms(element, obj_info: ObjectInfo):
    """Парсинг форм."""
    form_elems = get_xml_elements(element, ".//md:ChildObjects/md:Form")
    for fe in form_elems:
        name = (fe.text or "").strip()
        if name:
            obj_info.forms.append(name)


def _parse_templates(element, obj_info: ObjectInfo):
    """Парсинг макетов."""
    tpl_elems = get_xml_elements(element, ".//md:ChildObjects/md:Template")
    for te in tpl_elems:
        name = (te.text or "").strip()
        if name:
            obj_info.templates.append(name)


def _parse_commands(element, obj_info: ObjectInfo):
    """Парсинг команд."""
    cmd_elems = get_xml_elements(element, ".//md:ChildObjects/md:Command")
    for ce in cmd_elems:
        name = (ce.text or "").strip()
        if name:
            obj_info.commands.append(name)


def _parse_single_attribute(attr_element, tabular_section: str = "") -> Optional[AttributeInfo]:
    """Распарсить один реквизит."""
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


def _extract_references(attr_info: AttributeInfo, obj_info: ObjectInfo, owner_type: str):
    """Извлечь ссылки из типов реквизита и добавить в ObjectInfo.references."""
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
    """Получить имя дочернего объекта из атрибута или вложенного элемента."""
    name = element.get("name", "")
    if name:
        return name.strip()
    name = element.get("Name", "")
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
