"""XML helpers for parsing 1C metadata configuration dumps."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from lxml import etree

# Namespaces from 1C XML export
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

NSMAP_ALT_XR = {
    "md": NS_MD,
    "v8": NS_V8,
    "xr": NS_XR_ALT,
    "xsi": NS_XSI,
    "cfg": NS_CFG,
}

NSMAP_ROLES = {
    "r": NS_ROLES,
    "xs": "http://www.w3.org/2001/XMLSchema",
    "xsi": NS_XSI,
}


def _nsmap_candidates(nsmap: Optional[dict] = None) -> List[dict]:
    if nsmap is not None:
        return [nsmap]
    return [NSMAP, NSMAP_ALT_XR]


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Get XML text by XPath in a safe way."""
    if element is None:
        return default
    for ns in _nsmap_candidates(nsmap):
        try:
            found = element.xpath(xpath, namespaces=ns)
        except Exception:
            continue
        if found:
            first = found[0]
            if hasattr(first, "text"):
                return (first.text or default).strip()
            return str(first).strip() or default
    return default


def get_xml_elements(element: Any, xpath: str, nsmap: dict = None) -> list:
    """Get XML elements by XPath in a safe way."""
    if element is None:
        return []
    for ns in _nsmap_candidates(nsmap):
        try:
            result = element.xpath(xpath, namespaces=ns)
        except Exception:
            continue
        if result:
            return result
    return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Safely parse XML file and return root element."""
    if not os.path.exists(file_path):
        return None
    try:
        tree = etree.parse(file_path)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


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
    # Extra coverage for common register key variants.
    (r"(?:cfg:)?AccountingRegisterRecordKey\.([A-Za-zА-Яа-я0-9_]+)", "AccountingRegister"),
    (r"(?:cfg:)?CalculationRegisterRecordKey\.([A-Za-zА-Яа-я0-9_]+)", "CalculationRegister"),
]

_DEFINED_TYPE_PATTERNS = [
    r"(?:cfg:)?DefinedType\.([A-Za-zА-Яа-я0-9_]+)",
    r"(?:cfg:)?Type\.([A-Za-zА-Яа-я0-9_]+)",
]

_PRIMITIVE_TYPES = {
    "String",
    "Number",
    "Boolean",
    "Date",
    "UUID",
    "ValueStorage",
    "BinaryData",
    "Type",
    "AnyRef",
    "Undefined",
    "Null",
}


def _normalize_type_text(raw: str) -> str:
    text = (raw or "").strip()
    text = re.sub(r"\s+", "", text)
    return text


def _extract_type_text_candidates(type_element: Any) -> List[str]:
    candidates: List[str] = []
    if type_element is None:
        return candidates

    if hasattr(type_element, "text") and type_element.text:
        candidates.append(type_element.text)

    try:
        as_text = type_element.xpath("string(.)")
        if as_text:
            candidates.append(as_text)
    except Exception:
        pass

    for attr_name in ("type", "name", "value"):
        attr_val = getattr(type_element, "get", lambda *_: None)(attr_name)
        if attr_val:
            candidates.append(attr_val)

    # Keep order while removing duplicates and empties.
    unique: List[str] = []
    seen = set()
    for candidate in candidates:
        norm = _normalize_type_text(candidate)
        if norm and norm not in seen:
            seen.add(norm)
            unique.append(norm)
    return unique


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Parse v8:Type-like element into {type, name, full_type} dict."""
    if type_element is None:
        return None

    for value in _extract_type_text_candidates(type_element):
        for pattern, obj_type in _REF_PATTERNS:
            match = re.search(pattern, value, flags=re.IGNORECASE)
            if match:
                name = match.group(1)
                return {"type": obj_type, "name": name, "full_type": value}

        for pattern in _DEFINED_TYPE_PATTERNS:
            match = re.search(pattern, value, flags=re.IGNORECASE)
            if match:
                name = match.group(1)
                return {"type": "DefinedType", "name": name, "full_type": value}

        # Primitive values can be written as cfg:String or just String.
        primitive = re.sub(r"^cfg:", "", value, flags=re.IGNORECASE)
        primitive_base = primitive.split(".")[0]
        if primitive_base in _PRIMITIVE_TYPES:
            return {"type": "Primitive", "name": primitive_base, "full_type": value}

        # Fallback for unknown token: keep source value for diagnostics.
        if value:
            return {"type": "Unknown", "name": value, "full_type": value}

    return None


def parse_types_from_element(type_container: Any) -> list:
    """Extract all type entries from <Type>/<TypeSet> container."""
    if type_container is None:
        return []

    elements: List[Any] = []
    elements.append(type_container)

    for xpath in (
        ".//v8:Type",
        ".//v8:TypeSet",
        ".//*[local-name()='Type']",
        ".//*[local-name()='TypeSet']",
    ):
        elements.extend(get_xml_elements(type_container, xpath))

    parsed: List[Dict[str, str]] = []
    seen = set()
    for element in elements:
        value = parse_type_value(element)
        if value is None:
            continue
        key = (value["type"], value["name"], value["full_type"])
        if key not in seen:
            seen.add(key)
            parsed.append(value)
    return parsed


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
    "CalculationRegister": "Регистр расчёта",
    "Enum": "Перечисление",
    "ChartOfCharacteristicTypes": "План видов характеристик",
    "ChartOfAccounts": "План счетов",
    "ChartOfCalculationTypes": "План видов расчёта",
    "BusinessProcess": "Бизнес-процесс",
    "Task": "Задача",
    "ExchangePlan": "План обмена",
    "Report": "Отчёт",
    "DataProcessor": "Обработка",
    "CommonModule": "Общий модуль",
    "EventSubscription": "Подписка на событие",
    "Role": "Роль",
    "Constant": "Константа",
    "DocumentJournal": "Журнал документов",
}


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, f"{obj_type}s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"
