"""Парсер прочих объектов: подписки, общие модули, перечисления, обработки,
отчёты, бизнес-процессы, задачи, планы обмена, константы, планы видов характеристик,
планы счетов, планы видов расчёта, журналы документов."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, AttributeInfo, TabularSectionInfo, ReferenceInfo, TypeRef,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, get_type_folder, NSMAP,
)


def parse_event_subscription(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг подписки на событие."""
    xml_path = _find_object_xml(config_path, "EventSubscription", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    sub_el = _find_typed_element(root, "EventSubscription")

    obj_info.synonym = _get_property_text(sub_el, "Synonym")

    handler = get_xml_text(sub_el, ".//md:Properties/md:Handler")
    if not handler:
        handler = get_xml_text(sub_el, ".//md:Handler")
    obj_info.handler = handler

    event = get_xml_text(sub_el, ".//md:Properties/md:Event")
    if not event:
        event = get_xml_text(sub_el, ".//md:Event")
    obj_info.event = event

    source_paths = [
        ".//md:Properties/md:Source/md:Item",
        ".//md:Source/xr:Item",
        ".//md:Source/md:Item",
    ]
    for path in source_paths:
        items = get_xml_elements(sub_el, path)
        if items:
            for item in items:
                text = (item.text or "").strip()
                if text:
                    obj_info.source_types.append(text)
            break

    if not obj_info.source_types:
        source_text = get_xml_text(sub_el, ".//md:Properties/md:Source")
        if not source_text:
            source_text = get_xml_text(sub_el, ".//md:Source")
        if source_text:
            obj_info.source_types.append(source_text)

    return obj_info


def parse_common_module(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг общего модуля."""
    xml_path = _find_object_xml(config_path, "CommonModule", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    mod_el = _find_typed_element(root, "CommonModule")

    obj_info.synonym = _get_property_text(mod_el, "Synonym")

    obj_info.is_global = _get_bool_property(mod_el, "Global")
    obj_info.is_server = _get_bool_property(mod_el, "Server")
    obj_info.is_client = (
        _get_bool_property(mod_el, "ClientManagedApplication")
        or _get_bool_property(mod_el, "ClientOrdinaryApplication")
    )
    obj_info.is_external = _get_bool_property(mod_el, "ExternalConnection")

    return obj_info


def parse_enum(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг перечисления."""
    xml_path = _find_object_xml(config_path, "Enum", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    enum_el = _find_typed_element(root, "Enum")
    obj_info.synonym = _get_property_text(enum_el, "Synonym")

    value_elems = get_xml_elements(enum_el, ".//md:ChildObjects/md:EnumValue")
    if not value_elems:
        value_elems = get_xml_elements(enum_el, ".//md:EnumValues")

    for ve in value_elems:
        name = _get_child_object_name(ve)
        if name:
            obj_info.properties.setdefault("EnumValues", "")
            if obj_info.properties["EnumValues"]:
                obj_info.properties["EnumValues"] += ", "
            obj_info.properties["EnumValues"] += name

    return obj_info


def parse_data_processor(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг обработки."""
    return _parse_simple_object(config_path, obj_info, "DataProcessor")


def parse_report(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг отчёта."""
    return _parse_simple_object(config_path, obj_info, "Report")


def parse_business_process(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг бизнес-процесса."""
    xml_path = _find_object_xml(config_path, "BusinessProcess", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    bp_el = _find_typed_element(root, "BusinessProcess")
    obj_info.synonym = _get_property_text(bp_el, "Synonym")
    obj_info.comment = _get_property_text(bp_el, "Comment")

    task_ref = get_xml_text(bp_el, ".//md:Properties/md:Task")
    if task_ref:
        obj_info.properties["Task"] = task_ref
        parts = task_ref.split(".")
        if len(parts) >= 2:
            obj_info.references.append(ReferenceInfo(
                source_attribute="Task",
                target_type=parts[0],
                target_name=parts[1],
                ref_kind="attribute",
            ))

    _parse_common_attributes(bp_el, obj_info)
    _parse_common_tabular_sections(bp_el, obj_info)
    _parse_common_children(bp_el, obj_info)

    return obj_info


def parse_task_object(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг задачи."""
    xml_path = _find_object_xml(config_path, "Task", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    task_el = _find_typed_element(root, "Task")
    obj_info.synonym = _get_property_text(task_el, "Synonym")
    obj_info.comment = _get_property_text(task_el, "Comment")

    bp_ref = get_xml_text(task_el, ".//md:Properties/md:BusinessProcess")
    if bp_ref:
        obj_info.properties["BusinessProcess"] = bp_ref

    _parse_common_attributes(task_el, obj_info)
    _parse_common_tabular_sections(task_el, obj_info)
    _parse_common_children(task_el, obj_info)

    return obj_info


def parse_exchange_plan(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг плана обмена."""
    xml_path = _find_object_xml(config_path, "ExchangePlan", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    ep_el = _find_typed_element(root, "ExchangePlan")
    obj_info.synonym = _get_property_text(ep_el, "Synonym")
    obj_info.comment = _get_property_text(ep_el, "Comment")

    content_paths = [
        ".//md:Properties/md:Content/md:Item",
        ".//md:Content/xr:Item",
        ".//md:Content/md:Item",
    ]
    for path in content_paths:
        items = get_xml_elements(ep_el, path)
        if items:
            for item in items:
                text = (item.text or "").strip()
                if not text:
                    md_ref = get_xml_text(item, ".//md:Metadata")
                    if md_ref:
                        text = md_ref
                if text:
                    obj_info.source_types.append(text)
                    parts = text.split(".")
                    if len(parts) >= 2:
                        obj_info.references.append(ReferenceInfo(
                            source_attribute="Content",
                            target_type=parts[0],
                            target_name=parts[1],
                            ref_kind="attribute",
                        ))
            break

    _parse_common_attributes(ep_el, obj_info)
    _parse_common_tabular_sections(ep_el, obj_info)
    _parse_common_children(ep_el, obj_info)

    return obj_info


def parse_constant(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг константы."""
    xml_path = _find_object_xml(config_path, "Constant", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    const_el = _find_typed_element(root, "Constant")
    obj_info.synonym = _get_property_text(const_el, "Synonym")

    type_container = get_xml_elements(const_el, ".//md:Properties/md:Type")
    if not type_container:
        type_container = get_xml_elements(const_el, ".//md:Type")

    if type_container:
        parsed_types = parse_types_from_element(type_container[0])
        for pt in parsed_types:
            tr = TypeRef(obj_type=pt["type"], name=pt["name"], full_type=pt["full_type"])
            obj_info.attributes.append(AttributeInfo(
                name="Value", types=[tr],
            ))
            ref_types = {"Catalog", "Document", "Enum", "ChartOfCharacteristicTypes",
                         "ChartOfAccounts", "ChartOfCalculationTypes"}
            if pt["type"] in ref_types:
                obj_info.references.append(ReferenceInfo(
                    source_attribute="Value",
                    target_type=pt["type"],
                    target_name=pt["name"],
                    ref_kind="attribute",
                ))

    return obj_info


def parse_chart_of_characteristic_types(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг плана видов характеристик."""
    return _parse_chart(config_path, obj_info, "ChartOfCharacteristicTypes")


def parse_chart_of_accounts(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг плана счетов."""
    return _parse_chart(config_path, obj_info, "ChartOfAccounts")


def parse_chart_of_calculation_types(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг плана видов расчёта."""
    return _parse_chart(config_path, obj_info, "ChartOfCalculationTypes")


def parse_document_journal(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Парсинг журнала документов."""
    xml_path = _find_object_xml(config_path, "DocumentJournal", obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    dj_el = _find_typed_element(root, "DocumentJournal")
    obj_info.synonym = _get_property_text(dj_el, "Synonym")

    reg_docs_paths = [
        ".//md:Properties/md:RegisteredDocuments/md:Item",
        ".//md:RegisteredDocuments/xr:Item",
    ]
    for path in reg_docs_paths:
        items = get_xml_elements(dj_el, path)
        if items:
            for item in items:
                text = (item.text or "").strip()
                if text:
                    obj_info.source_types.append(text)
                    parts = text.split(".")
                    if len(parts) >= 2:
                        obj_info.references.append(ReferenceInfo(
                            source_attribute="RegisteredDocuments",
                            target_type=parts[0],
                            target_name=parts[1],
                            ref_kind="attribute",
                        ))
            break

    return obj_info


def parse_misc_object(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Диспетчер парсинга для прочих типов объектов."""
    parsers = {
        "EventSubscription": parse_event_subscription,
        "CommonModule": parse_common_module,
        "Enum": parse_enum,
        "DataProcessor": parse_data_processor,
        "Report": parse_report,
        "BusinessProcess": parse_business_process,
        "Task": parse_task_object,
        "ExchangePlan": parse_exchange_plan,
        "Constant": parse_constant,
        "ChartOfCharacteristicTypes": parse_chart_of_characteristic_types,
        "ChartOfAccounts": parse_chart_of_accounts,
        "ChartOfCalculationTypes": parse_chart_of_calculation_types,
        "DocumentJournal": parse_document_journal,
    }

    parser = parsers.get(obj_info.obj_type)
    if parser:
        return parser(config_path, obj_info)

    return obj_info


def _parse_chart(config_path: str, obj_info: ObjectInfo, obj_type: str) -> ObjectInfo:
    """Общий парсер для планов видов."""
    xml_path = _find_object_xml(config_path, obj_type, obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    chart_el = _find_typed_element(root, obj_type)
    obj_info.synonym = _get_property_text(chart_el, "Synonym")
    obj_info.comment = _get_property_text(chart_el, "Comment")

    _parse_common_attributes(chart_el, obj_info)
    _parse_common_tabular_sections(chart_el, obj_info)
    _parse_common_children(chart_el, obj_info)

    return obj_info


def _parse_simple_object(config_path: str, obj_info: ObjectInfo, obj_type: str) -> ObjectInfo:
    """Парсер простых объектов (обработки, отчёты)."""
    xml_path = _find_object_xml(config_path, obj_type, obj_info.name)
    if not xml_path:
        return obj_info

    root = parse_xml_file(xml_path)
    if root is None:
        return obj_info

    el = _find_typed_element(root, obj_type)
    obj_info.synonym = _get_property_text(el, "Synonym")
    obj_info.comment = _get_property_text(el, "Comment")

    _parse_common_attributes(el, obj_info)
    _parse_common_tabular_sections(el, obj_info)
    _parse_common_children(el, obj_info)

    return obj_info


def _parse_common_attributes(element, obj_info: ObjectInfo):
    attr_elems = get_xml_elements(element, ".//md:ChildObjects/md:Attribute")
    if not attr_elems:
        attr_elems = get_xml_elements(element, ".//md:Attributes")

    for ae in attr_elems:
        attr = _parse_single_attribute(ae)
        if attr:
            obj_info.attributes.append(attr)
            _extract_references(attr, obj_info)


def _parse_common_tabular_sections(element, obj_info: ObjectInfo):
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
            attr = _parse_single_attribute(tsa, tabular_section=ts_name)
            if attr:
                ts_info.attributes.append(attr)
                _extract_references(attr, obj_info)
        obj_info.tabular_sections.append(ts_info)


def _parse_common_children(element, obj_info: ObjectInfo):
    for fe in get_xml_elements(element, ".//md:ChildObjects/md:Form"):
        name = (fe.text or "").strip()
        if name:
            obj_info.forms.append(name)
    for te in get_xml_elements(element, ".//md:ChildObjects/md:Template"):
        name = (te.text or "").strip()
        if name:
            obj_info.templates.append(name)
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
                obj_type=pt["type"], name=pt["name"], full_type=pt["full_type"],
            ))

    return AttributeInfo(name=name, types=type_refs, tabular_section=tabular_section)


def _extract_references(attr: AttributeInfo, obj_info: ObjectInfo):
    ref_types = {"Catalog", "Document", "Enum", "ChartOfCharacteristicTypes",
                 "ChartOfAccounts", "ChartOfCalculationTypes", "BusinessProcess",
                 "Task", "ExchangePlan"}
    for tr in attr.types:
        if tr.obj_type in ref_types:
            obj_info.references.append(ReferenceInfo(
                source_attribute=attr.name,
                target_type=tr.obj_type,
                target_name=tr.name,
                tabular_section=attr.tabular_section,
                ref_kind="attribute",
            ))


def _find_object_xml(config_path: str, obj_type: str, name: str) -> Optional[str]:
    folder = get_type_folder(obj_type)
    candidates = [
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, folder, name, name + ".xml"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _find_typed_element(root, obj_type: str):
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


def _get_bool_property(element, prop_name: str) -> bool:
    val = _get_property_text(element, prop_name).lower()
    return val in ("true", "1")


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
