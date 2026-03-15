"""Парсер регистров: сведений, накопления, бухгалтерии, расчёта."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, get_type_folder, NSMAP,
)

_REGISTER_TYPES = {
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
}


def parse_register(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Распарсить XML регистра и заполнить ObjectInfo."""
    xml_path = _find_register_xml(config_path, obj_info.obj_type, obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    reg_el = _find_register_element(root, obj_info.obj_type)
    if reg_el is None:
        return obj_info

    obj_info.synonym = _get_property_text(reg_el, "Synonym")
    obj_info.comment = _get_property_text(reg_el, "Comment")

    _parse_dimensions(reg_el, obj_info)
    _parse_resources(reg_el, obj_info)
    _parse_attributes(reg_el, obj_info)

    if obj_info.obj_type in ("AccumulationRegister", "AccountingRegister", "CalculationRegister"):
        _parse_recorder(reg_el, obj_info)

    if obj_info.obj_type == "InformationRegister":
        _parse_info_register_properties(reg_el, obj_info)

    if obj_info.obj_type == "AccountingRegister":
        _parse_accounting_properties(reg_el, obj_info)

    if obj_info.obj_type == "CalculationRegister":
        _parse_calculation_properties(reg_el, obj_info)

    _parse_forms(reg_el, obj_info)
    _parse_templates(reg_el, obj_info)
    _parse_commands(reg_el, obj_info)

    return obj_info


def _find_register_xml(config_path: str, obj_type: str, name: str) -> Optional[str]:
    folder = get_type_folder(obj_type)
    candidates = [
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, folder, name, name + ".xml"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _find_register_element(root, obj_type: str):
    for child in root:
        local = _local_tag(child.tag)
        if local == obj_type:
            return child

    elems = get_xml_elements(root, f".//md:{obj_type}")
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


def _parse_dimensions(element, obj_info: ObjectInfo):
    """Парсинг измерений регистра."""
    dim_elems = get_xml_elements(element, ".//md:ChildObjects/md:Dimension")
    if not dim_elems:
        dim_elems = get_xml_elements(element, ".//md:Dimensions")

    for de in dim_elems:
        attr = _parse_single_attribute(de)
        if attr:
            attr.is_dimension = True
            obj_info.attributes.append(attr)
            _extract_references(attr, obj_info, ref_kind="dimension")


def _parse_resources(element, obj_info: ObjectInfo):
    """Парсинг ресурсов регистра."""
    res_elems = get_xml_elements(element, ".//md:ChildObjects/md:Resource")
    if not res_elems:
        res_elems = get_xml_elements(element, ".//md:Resources")

    for re_elem in res_elems:
        attr = _parse_single_attribute(re_elem)
        if attr:
            attr.is_resource = True
            obj_info.attributes.append(attr)
            _extract_references(attr, obj_info, ref_kind="resource")


def _parse_attributes(element, obj_info: ObjectInfo):
    """Парсинг реквизитов регистра."""
    attr_elems = get_xml_elements(element, ".//md:ChildObjects/md:Attribute")
    if not attr_elems:
        attr_elems = get_xml_elements(element, ".//md:Attributes")

    for ae in attr_elems:
        attr = _parse_single_attribute(ae)
        if attr:
            obj_info.attributes.append(attr)
            _extract_references(attr, obj_info, ref_kind="attribute")


def _parse_recorder(element, obj_info: ObjectInfo):
    """Парсинг регистратора (для регистров накопления, бухгалтерии, расчёта)."""
    pass


def _parse_info_register_properties(element, obj_info: ObjectInfo):
    """Свойства регистра сведений."""
    write_mode = get_xml_text(element, ".//md:Properties/md:WriteMode")
    if write_mode:
        obj_info.properties["WriteMode"] = write_mode

    periodicity = get_xml_text(element, ".//md:Properties/md:InformationRegisterPeriodicity")
    if periodicity:
        obj_info.properties["Periodicity"] = periodicity

    main_filter = get_xml_text(element, ".//md:Properties/md:MainFilterOnPeriod")
    if main_filter:
        obj_info.properties["MainFilterOnPeriod"] = main_filter


def _parse_accounting_properties(element, obj_info: ObjectInfo):
    """Свойства регистра бухгалтерии."""
    chart = get_xml_text(element, ".//md:Properties/md:ChartOfAccounts")
    if chart:
        obj_info.properties["ChartOfAccounts"] = chart
        parts = chart.split(".")
        if len(parts) >= 2:
            obj_info.references.append(ReferenceInfo(
                source_attribute="ChartOfAccounts",
                target_type=parts[0],
                target_name=parts[1],
                ref_kind="attribute",
            ))

    correspondence = get_xml_text(element, ".//md:Properties/md:Correspondence")
    if correspondence:
        obj_info.properties["Correspondence"] = correspondence


def _parse_calculation_properties(element, obj_info: ObjectInfo):
    """Свойства регистра расчёта."""
    chart = get_xml_text(element, ".//md:Properties/md:ChartOfCalculationTypes")
    if chart:
        obj_info.properties["ChartOfCalculationTypes"] = chart
        parts = chart.split(".")
        if len(parts) >= 2:
            obj_info.references.append(ReferenceInfo(
                source_attribute="ChartOfCalculationTypes",
                target_type=parts[0],
                target_name=parts[1],
                ref_kind="attribute",
            ))

    schedule = get_xml_text(element, ".//md:Properties/md:Schedule")
    if schedule:
        obj_info.properties["Schedule"] = schedule


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


def _parse_single_attribute(attr_element) -> Optional[AttributeInfo]:
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

    return AttributeInfo(name=name, types=type_refs)


def _extract_references(attr: AttributeInfo, obj_info: ObjectInfo, ref_kind: str = "attribute"):
    ref_types = {"Catalog", "Document", "Enum", "ChartOfCharacteristicTypes",
                 "ChartOfAccounts", "ChartOfCalculationTypes", "BusinessProcess",
                 "Task", "ExchangePlan"}
    for tr in attr.types:
        if tr.obj_type in ref_types:
            obj_info.references.append(ReferenceInfo(
                source_attribute=attr.name,
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind=ref_kind,
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
