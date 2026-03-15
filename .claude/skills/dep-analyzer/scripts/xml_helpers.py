"""XML helpers for parsing exported 1C configurations."""

from __future__ import annotations

import os
import re
from typing import Dict, List, Optional

from lxml import etree


NS_MD = "http://v8.1c.ru/8.3/MDClasses"
NS_V8 = "http://v8.1c.ru/8.1/data/core"
NS_XR = "http://v8.1c.ru/8.3/xcf/readable"
NS_XR_ALT = "http://v8.3/xcf/readable"
NS_XSI = "http://www.w3.org/2001/XMLSchema-instance"
NS_CFG = "http://v8.1c.ru/8.1/data/enterprise/current-config"
NS_ROLES = "http://v8.1c.ru/8.2/roles"

NSMAP = {
    "md": NS_MD,
    "v8": NS_V8,
    "xr": NS_XR,
    "xsi": NS_XSI,
    "cfg": NS_CFG,
}

NSMAP_ROLES = {
    "r": NS_ROLES,
    "xs": "http://www.w3.org/2001/XMLSchema",
    "xsi": NS_XSI,
}

PRIMITIVE_TYPES = {
    "string": "String",
    "boolean": "Boolean",
    "bool": "Boolean",
    "number": "Number",
    "decimal": "Number",
    "date": "Date",
    "datetime": "Date",
    "uuid": "UUID",
    "binarydata": "BinaryData",
    "valueStorage": "ValueStorage",
}

_REF_PATTERNS = [
    (r"(?:cfg:)?CatalogRef\.([A-Za-zА-Яа-я0-9_]+)", "Catalog"),
    (r"(?:cfg:)?DocumentRef\.([A-Za-zА-Яа-я0-9_]+)", "Document"),
    (r"(?:cfg:)?EnumRef\.([A-Za-zА-Яа-я0-9_]+)", "Enum"),
    (r"(?:cfg:)?ChartOfCharacteristicTypesRef\.([A-Za-zА-Яа-я0-9_]+)", "ChartOfCharacteristicTypes"),
    (r"(?:cfg:)?ChartOfAccountsRef\.([A-Za-zА-Яа-я0-9_]+)", "ChartOfAccounts"),
    (r"(?:cfg:)?ChartOfCalculationTypesRef\.([A-Za-zА-Яа-я0-9_]+)", "ChartOfCalculationTypes"),
    (r"(?:cfg:)?BusinessProcessRef\.([A-Za-zА-Яа-я0-9_]+)", "BusinessProcess"),
    (r"(?:cfg:)?TaskRef\.([A-Za-zА-Яа-я0-9_]+)", "Task"),
    (r"(?:cfg:)?ExchangePlanRef\.([A-Za-zА-Яа-я0-9_]+)", "ExchangePlan"),
    (r"(?:cfg:)?InformationRegisterRecordKey\.([A-Za-zА-Яа-я0-9_]+)", "InformationRegister"),
    (r"(?:cfg:)?AccumulationRegisterRecordKey\.([A-Za-zА-Яа-я0-9_]+)", "AccumulationRegister"),
]

_DEFINED_TYPE_PATTERNS = [
    r"(?:cfg:)?DefinedType\.([A-Za-zА-Яа-я0-9_]+)",
    r"(?:cfg:)?TypeDef\.([A-Za-zА-Яа-я0-9_]+)",
    r"(?:cfg:)?ValueType\.([A-Za-zА-Яа-я0-9_]+)",
]

TYPE_TO_FOLDER = {
    "Catalog": "Catalogs",
    "Document": "Documents",
    "InformationRegister": "InformationRegisters",
    "AccumulationRegister": "AccumulationRegisters",
    "AccountingRegister": "AccountingRegisters",
    "CalculationRegister": "CalculationRegisters",
    "Enum": "Enums",
    "ChartOfCharacteristicTypes": "ChartsOfCharacteristicTypes",
    "ChartOfAccounts": "ChartsOfAccounts",
    "ChartOfCalculationTypes": "ChartsOfCalculationTypes",
    "BusinessProcess": "BusinessProcesses",
    "Task": "Tasks",
    "ExchangePlan": "ExchangePlans",
    "Report": "Reports",
    "DataProcessor": "DataProcessors",
    "CommonModule": "CommonModules",
    "EventSubscription": "EventSubscriptions",
    "Role": "Roles",
    "Constant": "Constants",
    "DocumentJournal": "DocumentJournals",
    "ScheduledJob": "ScheduledJobs",
    "DefinedType": "DefinedTypes",
    "HTTPService": "HTTPServices",
    "WebService": "WebServices",
}

TYPE_TO_RU = {
    "Catalog": "Справочник",
    "Document": "Документ",
    "InformationRegister": "Регистр сведений",
    "AccumulationRegister": "Регистр накопления",
    "AccountingRegister": "Регистр бухгалтерии",
    "CalculationRegister": "Регистр расчета",
    "Enum": "Перечисление",
    "ChartOfCharacteristicTypes": "План видов характеристик",
    "ChartOfAccounts": "План счетов",
    "ChartOfCalculationTypes": "План видов расчета",
    "BusinessProcess": "Бизнес-процесс",
    "Task": "Задача",
    "ExchangePlan": "План обмена",
    "Report": "Отчет",
    "DataProcessor": "Обработка",
    "CommonModule": "Общий модуль",
    "EventSubscription": "Подписка на событие",
    "Role": "Роль",
    "Constant": "Константа",
    "DocumentJournal": "Журнал документов",
}


def _effective_nsmap(element, nsmap: Optional[dict] = None) -> dict:
    merged = dict(NSMAP)
    if nsmap:
        merged.update(nsmap)
    if element is None:
        return merged

    root = element.getroottree().getroot() if hasattr(element, "getroottree") else None
    if root is not None and getattr(root, "nsmap", None):
        for prefix, uri in root.nsmap.items():
            if uri:
                merged[prefix or "default"] = uri
                if uri in {NS_XR, NS_XR_ALT}:
                    merged["xr"] = uri
    return merged


def get_xml_text(element, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Return text by XPath and hide XML parsing errors."""

    if element is None:
        return default
    try:
        found = element.xpath(xpath, namespaces=_effective_nsmap(element, nsmap))
    except Exception:
        return default

    if not found:
        return default

    first = found[0]
    if hasattr(first, "text"):
        return (first.text or default).strip()
    return str(first).strip() or default


def get_xml_elements(element, xpath: str, nsmap: dict = None) -> list:
    """Return XML elements by XPath and hide parsing errors."""

    if element is None:
        return []
    try:
        return element.xpath(xpath, namespaces=_effective_nsmap(element, nsmap))
    except Exception:
        return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Parse XML file safely and return its root element."""

    if not os.path.exists(file_path):
        return None

    parser = etree.XMLParser(recover=True, remove_blank_text=False, huge_tree=True)
    try:
        tree = etree.parse(file_path, parser=parser)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


def _clean_type_text(value: str) -> str:
    value = re.sub(r"\s+", "", value or "")
    return value.strip()


def _local_name(value: str) -> str:
    if not value:
        return ""
    if "}" in value:
        value = value.split("}", 1)[1]
    if ":" in value:
        value = value.split(":", 1)[1]
    return value


def _candidate_strings(type_element) -> List[str]:
    candidates: List[str] = []
    if type_element is None:
        return candidates

    if isinstance(type_element, str):
        return [_clean_type_text(type_element)]

    text_chunks = [chunk.strip() for chunk in type_element.itertext() if chunk and chunk.strip()]
    if text_chunks:
        candidates.append(_clean_type_text(" ".join(text_chunks)))
        candidates.extend(_clean_type_text(chunk) for chunk in text_chunks)

    for attr_name, attr_value in type_element.attrib.items():
        candidates.append(_clean_type_text(str(attr_value)))
        local_attr = _local_name(attr_name)
        if local_attr.lower() in {"type", "name", "valuetype"}:
            candidates.append(_clean_type_text(str(attr_value)))

    for child in type_element.iterchildren():
        local = _local_name(child.tag)
        if child.text and child.text.strip():
            candidates.append(_clean_type_text(child.text))
        if local.lower() in {"type", "name", "valuetype", "typeset"}:
            candidates.append(_clean_type_text("".join(chunk.strip() for chunk in child.itertext())))
        for attr_value in child.attrib.values():
            candidates.append(_clean_type_text(str(attr_value)))

    return [candidate for candidate in candidates if candidate]


def parse_type_value(type_element) -> Optional[Dict[str, str]]:
    """Parse one type value into a structured representation."""

    for candidate in _candidate_strings(type_element):
        for pattern, obj_type in _REF_PATTERNS:
            match = re.search(pattern, candidate)
            if match:
                return {
                    "type": obj_type,
                    "name": match.group(1),
                    "full_type": candidate,
                }

        for pattern in _DEFINED_TYPE_PATTERNS:
            match = re.search(pattern, candidate)
            if match:
                return {
                    "type": "DefinedType",
                    "name": match.group(1),
                    "full_type": candidate,
                }

        primitive_match = re.search(r"(?:xs:|xsd:|v8:)?([A-Za-z][A-Za-z0-9]*)$", candidate)
        if primitive_match:
            primitive_key = primitive_match.group(1)
            normalized = PRIMITIVE_TYPES.get(primitive_key.lower())
            if normalized:
                return {
                    "type": normalized,
                    "name": normalized,
                    "full_type": candidate,
                }

    return None


def parse_types_from_element(type_container) -> list:
    """Extract all types from a type container."""

    if type_container is None:
        return []

    candidates = []
    seen = set()

    containers = [type_container]
    if not isinstance(type_container, str):
        containers.extend(
            node
            for node in type_container.xpath(".//*[local-name()='Type' or local-name()='TypeSet']")
        )

    for candidate in containers:
        parsed = parse_type_value(candidate)
        if not parsed:
            continue
        key = (parsed["type"], parsed["name"], parsed["full_type"])
        if key not in seen:
            seen.add(key)
            candidates.append(parsed)

    return candidates


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, obj_type + "s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"
