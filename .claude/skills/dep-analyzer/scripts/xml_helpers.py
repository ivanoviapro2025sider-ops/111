"""XML helpers for 1C metadata dumps."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

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

_XML_PARSER = etree.XMLParser(recover=True, remove_blank_text=False)


def _xpath(element: Any, xpath: str, nsmap: Optional[dict] = None) -> list:
    namespaces = nsmap or NSMAP
    try:
        result = element.xpath(xpath, namespaces=namespaces)
        if result or "xr:" not in xpath:
            return result
        return element.xpath(xpath, namespaces=NSMAP_ALT_XR)
    except Exception:
        if "xr:" in xpath:
            try:
                return element.xpath(xpath, namespaces=NSMAP_ALT_XR)
            except Exception:
                return []
        return []


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: Optional[dict] = None) -> str:
    """Safely fetch text or stringified value by XPath."""

    if element is None:
        return default
    found = _xpath(element, xpath, nsmap)
    if not found:
        return default
    value = found[0]
    if hasattr(value, "text"):
        return (value.text or default).strip()
    return str(value).strip() or default


def get_xml_elements(element: Any, xpath: str, nsmap: Optional[dict] = None) -> list:
    """Safely fetch elements by XPath."""

    if element is None:
        return []
    return _xpath(element, xpath, nsmap)


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Safely parse an XML file and return its root."""

    if not os.path.exists(file_path):
        return None
    try:
        tree = etree.parse(file_path, parser=_XML_PARSER)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


_REF_PATTERNS = [
    (r"(?:cfg:)?CatalogRef\.(\w+)", "Catalog"),
    (r"(?:cfg:)?DocumentRef\.(\w+)", "Document"),
    (r"(?:cfg:)?EnumRef\.(\w+)", "Enum"),
    (r"(?:cfg:)?ChartOfCharacteristicTypesRef\.(\w+)", "ChartOfCharacteristicTypes"),
    (r"(?:cfg:)?ChartOfAccountsRef\.(\w+)", "ChartOfAccounts"),
    (r"(?:cfg:)?ChartOfCalculationTypesRef\.(\w+)", "ChartOfCalculationTypes"),
    (r"(?:cfg:)?BusinessProcessRef\.(\w+)", "BusinessProcess"),
    (r"(?:cfg:)?TaskRef\.(\w+)", "Task"),
    (r"(?:cfg:)?ExchangePlanRef\.(\w+)", "ExchangePlan"),
    (r"(?:cfg:)?InformationRegisterRecordKey\.(\w+)", "InformationRegister"),
    (r"(?:cfg:)?AccumulationRegisterRecordKey\.(\w+)", "AccumulationRegister"),
]

_EXTRA_PATTERNS = [
    (r"(?:cfg:)?AccountingRegisterRecordKey\.(\w+)", "AccountingRegister"),
    (r"(?:cfg:)?CalculationRegisterRecordKey\.(\w+)", "CalculationRegister"),
    (r"(?:cfg:)?DefinedType\.(\w+)", "DefinedType"),
    (r"(?:cfg:)?Type\.(\w+)", "DefinedType"),
]

_PRIMITIVE_NAMES = {
    "String",
    "Number",
    "Boolean",
    "Date",
    "UUID",
    "ValueStorage",
    "BinaryData",
    "Type",
    "AnyRef",
    "ValueTable",
    "ValueTree",
}


def _normalize_type_tokens(raw_text: str) -> List[str]:
    text = raw_text.replace("\n", " ").replace("\r", " ")
    text = re.sub(r"[{}()]", " ", text)
    parts = re.split(r"[;,|]", text)
    tokens: List[str] = []
    for part in parts:
        candidate = part.strip()
        if not candidate:
            continue
        if " " in candidate and "." not in candidate:
            for token in candidate.split():
                if token:
                    tokens.append(token.strip())
        else:
            tokens.append(candidate)
    return tokens


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Parse a v8:Type-like value into a normalized dict."""

    if type_element is None:
        return None

    raw = ""
    if isinstance(type_element, str):
        raw = type_element
    elif hasattr(type_element, "itertext"):
        raw = " ".join(chunk.strip() for chunk in type_element.itertext() if chunk and chunk.strip())
    else:
        raw = str(type_element)

    raw = raw.strip()
    if not raw:
        return None

    for token in _normalize_type_tokens(raw):
        for pattern, obj_type in _REF_PATTERNS + _EXTRA_PATTERNS:
            match = re.search(pattern, token)
            if match:
                return {"type": obj_type, "name": match.group(1), "full_type": token}

        bare = token.replace("cfg:", "")
        if bare in _PRIMITIVE_NAMES:
            return {"type": "Primitive", "name": bare, "full_type": token}

    return {"type": "Unknown", "name": raw.replace("cfg:", ""), "full_type": raw}


def parse_types_from_element(type_container: Any) -> list:
    """Extract all types from <Type> containers and nested TypeSet values."""

    if type_container is None:
        return []

    values: List[Dict[str, str]] = []
    seen = set()
    elements = []
    if hasattr(type_container, "xpath"):
        elements = type_container.xpath(
            ".//*[local-name()='Type' or local-name()='TypeSet'] | self::*[local-name()='Type' or local-name()='TypeSet']"
        )
    if not elements:
        elements = [type_container]

    for element in elements:
        raw = ""
        if hasattr(element, "itertext"):
            raw = " ".join(chunk.strip() for chunk in element.itertext() if chunk and chunk.strip())
        else:
            raw = str(element)
        for token in _normalize_type_tokens(raw):
            parsed = parse_type_value(token)
            if not parsed:
                continue
            key = (parsed["type"], parsed["name"], parsed["full_type"])
            if key in seen:
                continue
            seen.add(key)
            values.append(parsed)
    return values


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
    "ScheduledJob": "Регламентное задание",
    "DefinedType": "Определяемый тип",
    "HTTPService": "HTTP-сервис",
    "WebService": "Веб-сервис",
}


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, f"{obj_type}s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"
