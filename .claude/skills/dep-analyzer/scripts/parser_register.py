"""Парсер регистров: сведений, накопления, бухгалтерии, расчёта."""

import os
from typing import Dict, List

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, _detect_nsmap, NSMAP,
)

_REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}


def parse_registers(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Парсинг всех регистров в индексе."""
    for key, obj in objects.items():
        if obj.obj_type in _REGISTER_TYPES:
            parse_register(obj)
    return objects


def parse_register(obj_info: ObjectInfo) -> ObjectInfo:
    """Полный парсинг регистра: измерения, ресурсы, реквизиты, регистратор."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    nsmap = _detect_nsmap(root)

    _parse_dimensions(obj_info, root, nsmap)
    _parse_resources(obj_info, root, nsmap)
    _parse_attributes(obj_info, root, nsmap)
    _parse_record_type(obj_info, root, nsmap)
    _parse_forms(obj_info, root, nsmap)

    return obj_info


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


def _parse_dimensions(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг измерений регистра."""
    dim_xpaths = [
        ".//md:Dimensions",
        ".//md:ChildObjects/md:Dimension",
    ]

    for xp in dim_xpaths:
        dim_elements = get_xml_elements(root, xp, nsmap)
        for dim_el in dim_elements:
            dim_name = get_xml_text(dim_el, ".//md:Properties/md:Name", nsmap=nsmap)
            if not dim_name:
                dim_name = get_xml_text(dim_el, "md:Name", nsmap=nsmap)
            if not dim_name:
                dim_name = dim_el.get("name", "")
            if not dim_name:
                continue

            type_container = get_xml_elements(dim_el, ".//md:Properties/md:Type", nsmap)
            if not type_container:
                type_container = get_xml_elements(dim_el, ".//md:Type", nsmap)

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
                        source_attribute=dim_name,
                        target_type=p["type"],
                        target_name=p["name"],
                        ref_kind="dimension",
                    ))

            obj_info.attributes.append(AttributeInfo(
                name=dim_name,
                types=types,
                is_dimension=True,
            ))


def _parse_resources(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг ресурсов регистра."""
    res_xpaths = [
        ".//md:Resources",
        ".//md:ChildObjects/md:Resource",
    ]

    for xp in res_xpaths:
        res_elements = get_xml_elements(root, xp, nsmap)
        for res_el in res_elements:
            res_name = get_xml_text(res_el, ".//md:Properties/md:Name", nsmap=nsmap)
            if not res_name:
                res_name = get_xml_text(res_el, "md:Name", nsmap=nsmap)
            if not res_name:
                res_name = res_el.get("name", "")
            if not res_name:
                continue

            type_container = get_xml_elements(res_el, ".//md:Properties/md:Type", nsmap)
            if not type_container:
                type_container = get_xml_elements(res_el, ".//md:Type", nsmap)

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
                        source_attribute=res_name,
                        target_type=p["type"],
                        target_name=p["name"],
                        ref_kind="resource",
                    ))

            obj_info.attributes.append(AttributeInfo(
                name=res_name,
                types=types,
                is_resource=True,
            ))


def _parse_attributes(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг реквизитов (attributes) регистра."""
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


def _parse_record_type(obj_info: ObjectInfo, root, nsmap: dict):
    """Парсинг специфичных свойств регистра: тип, периодичность, регистратор."""
    record_type = get_xml_text(root, ".//md:Properties/md:RegisterType", nsmap=nsmap)
    if record_type:
        obj_info.properties["RegisterType"] = record_type

    periodicity = get_xml_text(root, ".//md:Properties/md:InformationRegisterPeriodicity", nsmap=nsmap)
    if periodicity:
        obj_info.properties["Periodicity"] = periodicity

    write_mode = get_xml_text(root, ".//md:Properties/md:WriteMode", nsmap=nsmap)
    if write_mode:
        obj_info.properties["WriteMode"] = write_mode


def _parse_forms(obj_info: ObjectInfo, root, nsmap: dict):
    for xp in [".//md:ChildObjects/md:Form", ".//md:Forms"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.forms.append(name.strip())
