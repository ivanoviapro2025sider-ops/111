"""Парсер документов (Documents): реквизиты, ТЧ, движения, ввод на основании."""

import os
from typing import Dict, List

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, _detect_nsmap, NSMAP,
)


def parse_document(obj_info: ObjectInfo) -> ObjectInfo:
    """Полный парсинг документа: реквизиты, ТЧ, движения, ввод на основании."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    nsmap = _detect_nsmap(root)

    _parse_register_records(obj_info, root, nsmap)
    _parse_based_on(obj_info, root, nsmap)
    _parse_attributes(obj_info, root, nsmap)
    _parse_tabular_sections(obj_info, root, nsmap)
    _parse_forms(obj_info, root, nsmap)
    _parse_templates(obj_info, root, nsmap)
    _parse_commands(obj_info, root, nsmap)

    return obj_info


def parse_documents(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Парсинг всех документов в индексе."""
    for key, obj in objects.items():
        if obj.obj_type == "Document":
            parse_document(obj)
    return objects


def _find_object_xml(obj_info: ObjectInfo) -> str:
    candidates = []
    if obj_info.path:
        if os.path.isdir(obj_info.path):
            candidates.append(os.path.join(obj_info.path, f"{obj_info.name}.xml"))
        elif obj_info.path.endswith(".xml"):
            candidates.append(obj_info.path)
        candidates.append(obj_info.path + ".xml")

    for c in candidates:
        if os.path.isfile(c):
            return c
    return ""


def _parse_register_records(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг регистров движений документа."""
    reg_xpaths = [
        ".//md:Properties/md:RegisterRecords/v8:Type",
        ".//md:RegisterRecords/v8:Type",
        ".//md:Properties/md:RegisterRecords/xr:Item",
        ".//md:RegisterRecords/xr:Item",
    ]

    for xp in reg_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            text = el.text if hasattr(el, "text") else str(el)
            if text:
                text = text.strip()
                reg_name = _extract_register_name(text)
                if reg_name and reg_name not in obj_info.movement_registers:
                    obj_info.movement_registers.append(reg_name)

    reg_records_xpath = ".//md:Properties/md:RegisterRecords"
    containers = get_xml_elements(root, reg_records_xpath, nsmap)
    for container in containers:
        for child in container:
            if hasattr(child, "text") and child.text:
                reg_name = _extract_register_name(child.text.strip())
                if reg_name and reg_name not in obj_info.movement_registers:
                    obj_info.movement_registers.append(reg_name)


def _extract_register_name(text: str) -> str:
    """Извлечь имя регистра из текстового описания типа."""
    import re

    patterns = [
        r"AccumulationRegister\.(\w+)",
        r"InformationRegister\.(\w+)",
        r"AccountingRegister\.(\w+)",
        r"CalculationRegister\.(\w+)",
        r"РегистрНакопления\.(\w+)",
        r"РегистрСведений\.(\w+)",
        r"РегистрБухгалтерии\.(\w+)",
        r"РегистрРасчёта\.(\w+)",
    ]

    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return m.group(0)

    if "." in text:
        return text

    return text


def _parse_based_on(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг документов/объектов ввода на основании."""
    based_on_xpaths = [
        ".//md:Properties/md:BasedOn/v8:Type",
        ".//md:BasedOn/v8:Type",
        ".//md:Properties/md:InputByString",
    ]

    for xp in based_on_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            text = el.text if hasattr(el, "text") else str(el)
            if text:
                text = text.strip()
                if "Ref." in text or "." in text:
                    if text not in obj_info.based_on:
                        obj_info.based_on.append(text)


def _parse_attributes(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг реквизитов документа."""
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
                        ref_kind="attribute",
                    ))

            obj_info.attributes.append(AttributeInfo(name=attr_name, types=types))


def _parse_tabular_sections(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг табличных частей документа."""
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
    for xp in [".//md:ChildObjects/md:Form", ".//md:Forms"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.forms.append(name.strip())


def _parse_templates(obj_info: ObjectInfo, root, nsmap: dict):
    for xp in [".//md:ChildObjects/md:Template", ".//md:Templates"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.templates.append(name.strip())


def _parse_commands(obj_info: ObjectInfo, root, nsmap: dict):
    for xp in [".//md:ChildObjects/md:Command", ".//md:Commands"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.commands.append(name.strip())
