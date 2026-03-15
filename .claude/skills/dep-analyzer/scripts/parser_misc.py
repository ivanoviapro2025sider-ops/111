"""Парсер прочих объектов: подписки, общие модули, перечисления, обработки, отчёты,
бизнес-процессы, задачи, планы обмена, константы."""

import os
from typing import Dict, List

from models import ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, _detect_nsmap, NSMAP,
)


def parse_misc_objects(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Парсинг всех прочих объектов в индексе."""
    _PARSERS = {
        "EventSubscription": _parse_event_subscription,
        "CommonModule": _parse_common_module,
        "Enum": _parse_enum,
        "DataProcessor": _parse_data_processor,
        "Report": _parse_report,
        "BusinessProcess": _parse_business_process,
        "Task": _parse_task,
        "ExchangePlan": _parse_exchange_plan,
        "Constant": _parse_constant,
        "ChartOfCharacteristicTypes": _parse_chart_of_characteristic_types,
        "ChartOfAccounts": _parse_chart_of_accounts,
        "ChartOfCalculationTypes": _parse_chart_of_calculation_types,
    }

    for key, obj in objects.items():
        parser_fn = _PARSERS.get(obj.obj_type)
        if parser_fn:
            parser_fn(obj)

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


def _parse_event_subscription(obj_info: ObjectInfo):
    """Парсинг подписки на событие: обработчик, источники, событие."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)

    handler = get_xml_text(root, ".//md:Properties/md:Handler", nsmap=nsmap)
    if not handler:
        handler = get_xml_text(root, ".//md:Handler", nsmap=nsmap)
    obj_info.handler = handler

    event = get_xml_text(root, ".//md:Properties/md:Event", nsmap=nsmap)
    if not event:
        event = get_xml_text(root, ".//md:Event", nsmap=nsmap)
    obj_info.event = event

    source_xpaths = [
        ".//md:Properties/md:Source/v8:Type",
        ".//md:Source/v8:Type",
        ".//md:Properties/md:Source/v8:Item",
    ]
    for xp in source_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            text = el.text if hasattr(el, "text") else str(el)
            if text and text.strip():
                obj_info.source_types.append(text.strip())


def _parse_common_module(obj_info: ObjectInfo):
    """Парсинг общего модуля: флаги серверный/клиентский/глобальный."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)

    global_val = get_xml_text(root, ".//md:Properties/md:Global", nsmap=nsmap)
    obj_info.is_global = global_val.lower() == "true" if global_val else False

    server_val = get_xml_text(root, ".//md:Properties/md:Server", nsmap=nsmap)
    obj_info.is_server = server_val.lower() == "true" if server_val else False

    client_managed = get_xml_text(root, ".//md:Properties/md:ClientManagedApplication", nsmap=nsmap)
    client_ordinary = get_xml_text(root, ".//md:Properties/md:ClientOrdinaryApplication", nsmap=nsmap)
    obj_info.is_client = (
        (client_managed and client_managed.lower() == "true")
        or (client_ordinary and client_ordinary.lower() == "true")
    )

    external_val = get_xml_text(root, ".//md:Properties/md:ExternalConnection", nsmap=nsmap)
    obj_info.is_external = external_val.lower() == "true" if external_val else False


def _parse_enum(obj_info: ObjectInfo):
    """Парсинг перечисления: значения."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)

    value_xpaths = [
        ".//md:ChildObjects/md:EnumValue",
        ".//md:EnumValues",
    ]
    for xp in value_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = get_xml_text(el, ".//md:Properties/md:Name", nsmap=nsmap)
            if not name:
                name = get_xml_text(el, "md:Name", nsmap=nsmap)
            if not name:
                name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.properties.setdefault("EnumValues", "")
                if obj_info.properties["EnumValues"]:
                    obj_info.properties["EnumValues"] += ", "
                obj_info.properties["EnumValues"] += name.strip()


def _parse_data_processor(obj_info: ObjectInfo):
    """Парсинг обработки: формы, макеты, команды."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_report(obj_info: ObjectInfo):
    """Парсинг отчёта: формы, макеты, команды."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_business_process(obj_info: ObjectInfo):
    """Парсинг бизнес-процесса: реквизиты, ТЧ, формы."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_task(obj_info: ObjectInfo):
    """Парсинг задачи: реквизиты, формы."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_exchange_plan(obj_info: ObjectInfo):
    """Парсинг плана обмена: реквизиты, ТЧ, состав."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)

    content_xpaths = [
        ".//md:Properties/md:Content/xr:Item",
        ".//md:Content/xr:Item",
    ]
    for xp in content_xpaths:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            md_obj = get_xml_text(el, "xr:Metadata", nsmap=nsmap)
            if md_obj:
                obj_info.properties.setdefault("ExchangeContent", "")
                if obj_info.properties["ExchangeContent"]:
                    obj_info.properties["ExchangeContent"] += ", "
                obj_info.properties["ExchangeContent"] += md_obj


def _parse_constant(obj_info: ObjectInfo):
    """Парсинг константы: тип значения."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)

    type_container = get_xml_elements(root, ".//md:Properties/md:Type", nsmap)
    if not type_container:
        type_container = get_xml_elements(root, ".//md:Type", nsmap)

    if type_container:
        parsed = parse_types_from_element(type_container[0], nsmap)
        for p in parsed:
            obj_info.references.append(ReferenceInfo(
                source_attribute="Value",
                target_type=p["type"],
                target_name=p["name"],
                ref_kind="attribute",
            ))


def _parse_chart_of_characteristic_types(obj_info: ObjectInfo):
    """Парсинг плана видов характеристик."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_chart_of_accounts(obj_info: ObjectInfo):
    """Парсинг плана счетов."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_chart_of_calculation_types(obj_info: ObjectInfo):
    """Парсинг плана видов расчёта."""
    xml_path = _find_object_xml(obj_info)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)
    _parse_generic_attributes(obj_info, root, nsmap)
    _parse_forms_templates_commands(obj_info, root, nsmap)


def _parse_generic_attributes(obj_info: ObjectInfo, root, nsmap: dict):
    """Общий парсинг реквизитов для объектов без специализированного парсера."""
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
                continue

            type_container = get_xml_elements(attr_el, ".//md:Properties/md:Type", nsmap)
            if not type_container:
                type_container = get_xml_elements(attr_el, ".//md:Type", nsmap)

            if type_container:
                parsed = parse_types_from_element(type_container[0], nsmap)
                for p in parsed:
                    obj_info.references.append(ReferenceInfo(
                        source_attribute=attr_name,
                        target_type=p["type"],
                        target_name=p["name"],
                        ref_kind="attribute",
                    ))


def _parse_forms_templates_commands(obj_info: ObjectInfo, root, nsmap: dict):
    """Общий парсинг форм, макетов, команд."""
    for xp in [".//md:ChildObjects/md:Form", ".//md:Forms"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.forms.append(name.strip())

    for xp in [".//md:ChildObjects/md:Template", ".//md:Templates"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.templates.append(name.strip())

    for xp in [".//md:ChildObjects/md:Command", ".//md:Commands"]:
        elements = get_xml_elements(root, xp, nsmap)
        for el in elements:
            name = el.text if hasattr(el, "text") and el.text else ""
            if name and name.strip():
                obj_info.commands.append(name.strip())
