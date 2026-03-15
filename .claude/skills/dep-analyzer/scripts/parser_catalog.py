"""Парсер справочников (Catalogs): реквизиты, табличные части, иерархия, владельцы."""

import os
from typing import Dict, List

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, _detect_nsmap, NSMAP,
)


def parse_catalog(obj_info: ObjectInfo) -> ObjectInfo:
    """Полный парсинг справочника: реквизиты, ТЧ, владельцы, иерархия."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    nsmap = _detect_nsmap(root)

    _parse_owners(obj_info, root, nsmap)
    _parse_hierarchy(obj_info, root, nsmap)
    _parse_attributes(obj_info, root, nsmap)
    _parse_tabular_sections(obj_info, root, nsmap)
    _parse_forms(obj_info, root, nsmap)
    _parse_templates(obj_info, root, nsmap)
    _parse_commands(obj_info, root, nsmap)

    return obj_info


def parse_catalogs(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Парсинг всех справочников в индексе."""
    for key, obj in objects.items():
        if obj.obj_type == "Catalog":
            parse_catalog(obj)
    return objects


def _find_object_xml(obj_info: ObjectInfo) -> str:
    """Найти XML-файл объекта."""
    candidates = []
    if obj_info.path:
        if os.path.isdir(obj_info.path):
            candidates.append(os.path.join(obj_info.path, f"{obj_info.name}.xml"))
            candidates.append(os.path.join(obj_info.path, "Ext", "ObjectModule.xml"))
        elif obj_info.path.endswith(".xml"):
            candidates.append(obj_info.path)
        candidates.append(obj_info.path + ".xml")

    for c in candidates:
        if os.path.isfile(c):
            return c
    return ""


def _parse_owners(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг владельцев справочника."""
    owner_xpaths = [
        ".//md:Properties/md:Owners/v8:Type",
        ".//md:Owners/v8:Type",
        ".//md:Properties/md:Owners/v8:Item",
        ".//md:Owners/xr:Item",
    ]
    for xp in owner_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            text = el.text if hasattr(el, "text") else str(el)
            if text and "Ref." in text:
                parts = text.strip().split(".")
                if len(parts) >= 2:
                    target_type = parts[0].replace("cfg:", "").replace("Ref", "")
                    target_name = parts[-1]
                    if target_type and target_name:
                        obj_info.references.append(ReferenceInfo(
                            source_attribute="Owner",
                            target_type=_normalize_type(target_type),
                            target_name=target_name,
                            ref_kind="owner",
                        ))


def _parse_hierarchy(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг настроек иерархии."""
    hier_type = get_xml_text(root, ".//md:Properties/md:HierarchyType", nsmap=nsmap)
    is_hierarchical = get_xml_text(root, ".//md:Properties/md:Hierarchical", nsmap=nsmap)

    if is_hierarchical and is_hierarchical.lower() == "true":
        obj_info.properties["Hierarchical"] = "true"
        if hier_type:
            obj_info.properties["HierarchyType"] = hier_type


def _parse_attributes(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг реквизитов."""
    attr_xpaths = [
        ".//md:Attributes",
        ".//md:ChildObjects/md:Attribute",
    ]

    for xp in attr_xpaths:
        attr_elements = get_xml_elements(root, xp, nsmap)
        for attr_el in attr_elements:
            attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", nsmap=nsmap)
            if not attr_name:
                attr_name = get_xml_text(attr_el, "md:Name", nsmap=nsmap)
            if not attr_name:
                attr_name = attr_el.get("name", "")
            if not attr_name:
                continue

            type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
            if not type_container:
                type_container = get_xml_elements(attr_el, ".//md:Type", nsmap)

            types = []
            refs = []
            if type_container:
                parsed = parse_types_from_element(type_container[0], nsmap)
                for p in parsed:
                    types.append(TypeRef(
                        obj_type=p["type"],
                        name=p["name"],
                        full_type=p["full_type"],
                    ))
                    refs.append(ReferenceInfo(
                        source_attribute=attr_name,
                        target_type=p["type"],
                        target_name=p["name"],
                        ref_kind="attribute",
                    ))

            obj_info.attributes.append(AttributeInfo(name=attr_name, types=types))
            obj_info.references.extend(refs)


def _parse_tabular_sections(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг табличных частей."""
    ts_xpaths = [
        ".//md:TabularSections",
        ".//md:ChildObjects/md:TabularSection",
    ]

    for xp in ts_xpaths:
        ts_elements = get_xml_elements(root, xp, nsmap)
        for ts_el in ts_elements:
            ts_name = get_xml_text(ts_el, ".//md:Properties/md:Name", nsmap=nsmap)
            if not ts_name:
                ts_name = get_xml_text(ts_el, "md:Name", nsmap=nsmap)
            if not ts_name:
                ts_name = ts_el.get("name", "")
            if not ts_name:
                continue

            ts_info = TabularSectionInfo(name=ts_name)

            ts_attrs = get_xml_elements(ts_el, ".//md:Attributes", nsmap)
            if not ts_attrs:
                ts_attrs = get_xml_elements(ts_el, ".//md:ChildObjects/md:Attribute", nsmap)

            for attr_el in ts_attrs:
                attr_name = get_xml_text(attr_el, ".//md:Properties/md:Name", nsmap=nsmap)
                if not attr_name:
                    attr_name = get_xml_text(attr_el, "md:Name", nsmap=nsmap)
                if not attr_name:
                    continue

                type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
                if not type_container:
                    type_container = get_xml_elements(attr_el, ".//md:Type", nsmap)

                types = []
                if type_container:
                    parsed = parse_types_from_element(type_container[0], nsmap)
                    for p in parsed:
                        types.append(TypeRef(
                            obj_type=p["type"],
                            name=p["name"],
                            full_type=p["full_type"],
                        ))
                        obj_info.references.append(ReferenceInfo(
                            source_attribute=attr_name,
                            target_type=p["type"],
                            target_name=p["name"],
                            tabular_section=ts_name,
                            ref_kind="attribute",
                        ))

                ts_info.attributes.append(AttributeInfo(
                    name=attr_name,
                    types=types,
                    tabular_section=ts_name,
                ))

            obj_info.tabular_sections.append(ts_info)


def _parse_forms(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг списка форм."""
    form_xpaths = [
        ".//md:ChildObjects/md:Form",
        ".//md:Forms",
    ]
    for xp in form_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.forms.append(name.strip())


def _parse_templates(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг списка макетов."""
    for xp in [".//md:ChildObjects/md:Template", ".//md:Templates"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.templates.append(name.strip())


def _parse_commands(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг списка команд."""
    for xp in [".//md:ChildObjects/md:Command", ".//md:Commands"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.commands.append(name.strip())


def _normalize_type(raw: str) -> str:
    """Нормализация имени типа."""
    mapping = {
        "Catalog": "Catalog",
        "Document": "Document",
        "Enum": "Enum",
        "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
        "ChartOfAccounts": "ChartOfAccounts",
        "ExchangePlan": "ExchangePlan",
        "BusinessProcess": "BusinessProcess",
        "Task": "Task",
    }
    return mapping.get(raw, raw)
