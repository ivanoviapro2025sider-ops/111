"""XML helpers for parsing 1C configuration dumps."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, Iterable, List, Optional

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

NSMAP_XR_ALT = {
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

_NSMAP_VARIANTS = (NSMAP, NSMAP_XR_ALT)


def _xpath_variants(element: Any, xpath: str, nsmap: Optional[dict] = None) -> List[Any]:
    namespaces = (nsmap,) if nsmap else _NSMAP_VARIANTS
    for current in namespaces:
        try:
            result = element.xpath(xpath, namespaces=current)
        except Exception:
            continue
        if result:
            return result
    return []


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Safely return element text by XPath."""

    if element is None:
        return default
    found = _xpath_variants(element, xpath, nsmap)
    if not found:
        return default

    first = found[0]
    if isinstance(first, etree._Element):
        text = "".join(first.itertext()).strip()
    else:
        text = str(first).strip()
    return text or default


def get_xml_elements(element: Any, xpath: str, nsmap: dict = None) -> List[Any]:
    """Safely return elements by XPath."""

    if element is None:
        return []
    return _xpath_variants(element, xpath, nsmap)


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Parse XML and return the root element."""

    if not os.path.exists(file_path):
        return None

    parser = etree.XMLParser(recover=True, remove_blank_text=False, resolve_entities=False)
    try:
        tree = etree.parse(file_path, parser)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


_REF_PATTERNS = [
    (r"(?:cfg:)?CatalogRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "Catalog"),
    (r"(?:cfg:)?DocumentRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "Document"),
    (r"(?:cfg:)?EnumRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "Enum"),
    (r"(?:cfg:)?ChartOfCharacteristicTypesRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "ChartOfCharacteristicTypes"),
    (r"(?:cfg:)?ChartOfAccountsRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "ChartOfAccounts"),
    (r"(?:cfg:)?ChartOfCalculationTypesRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "ChartOfCalculationTypes"),
    (r"(?:cfg:)?BusinessProcessRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "BusinessProcess"),
    (r"(?:cfg:)?TaskRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "Task"),
    (r"(?:cfg:)?ExchangePlanRef\.([A-Za-zА-Яа-яЁё0-9_]+)", "ExchangePlan"),
    (r"(?:cfg:)?InformationRegisterRecordKey\.([A-Za-zА-Яа-яЁё0-9_]+)", "InformationRegister"),
    (r"(?:cfg:)?AccumulationRegisterRecordKey\.([A-Za-zА-Яа-яЁё0-9_]+)", "AccumulationRegister"),
    (r"(?:cfg:)?AccountingRegisterRecordKey\.([A-Za-zА-Яа-яЁё0-9_]+)", "AccountingRegister"),
    (r"(?:cfg:)?CalculationRegisterRecordKey\.([A-Za-zА-Яа-яЁё0-9_]+)", "CalculationRegister"),
    (r"(?:cfg:)?DefinedType\.([A-Za-zА-Яа-яЁё0-9_]+)", "DefinedType"),
]

_PRIMITIVE_TYPES = {
    "String",
    "Boolean",
    "Date",
    "Number",
    "UUID",
    "TypeDescription",
    "ValueStorage",
    "BinaryData",
    "AnyRef",
    "Undefined",
}


def _iter_candidates(type_element: Any) -> Iterable[str]:
    if type_element is None:
        return []
    if isinstance(type_element, str):
        return [type_element]

    values: List[str] = []
    text = "".join(type_element.itertext()).strip()
    if text:
        values.append(text)

    for key, value in type_element.attrib.items():
        if value:
            values.append(value)
        if key:
            values.append(key)

    try:
        xml = etree.tostring(type_element, encoding="unicode")
    except Exception:
        xml = ""
    if xml:
        values.append(xml)

    qname = etree.QName(type_element.tag)
    if qname.localname:
        values.append(qname.localname)

    return values


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Parse a single 1C type declaration into a uniform mapping."""

    for candidate in _iter_candidates(type_element):
        normalized = candidate.replace("\n", " ").strip()
        if not normalized:
            continue

        for pattern, obj_type in _REF_PATTERNS:
            match = re.search(pattern, normalized)
            if match:
                name = match.group(1)
                full_type = match.group(0)
                return {"type": obj_type, "name": name, "full_type": full_type}

        primitive_match = re.search(
            r"(?:cfg:)?(" + "|".join(sorted(_PRIMITIVE_TYPES, key=len, reverse=True)) + r")\b",
            normalized,
        )
        if primitive_match:
            primitive = primitive_match.group(1)
            return {"type": primitive, "name": primitive, "full_type": primitive}

        array_match = re.search(r"(?:cfg:)?ArrayOf\.([A-Za-zА-Яа-яЁё0-9_.:]+)", normalized)
        if array_match:
            subtype = array_match.group(1)
            return {"type": "Array", "name": subtype, "full_type": f"ArrayOf.{subtype}"}

        if normalized in _PRIMITIVE_TYPES:
            return {"type": normalized, "name": normalized, "full_type": normalized}

    return None


def parse_types_from_element(type_container: Any) -> List[Dict[str, str]]:
    """Extract all type declarations from a <Type> container."""

    if type_container is None:
        return []

    elements: List[Any] = []
    if isinstance(type_container, etree._Element):
        nested_types = type_container.xpath(".//*[local-name()='Type' or local-name()='TypeSet']")
        if nested_types:
            elements.extend(nested_types)
        else:
            elements.append(type_container)
    else:
        elements.append(type_container)

    results: List[Dict[str, str]] = []
    seen = set()
    for element in elements:
        parsed = parse_type_value(element)
        if not parsed:
            continue
        signature = (parsed["type"], parsed["name"], parsed["full_type"])
        if signature in seen:
            continue
        seen.add(signature)
        results.append(parsed)
    return results


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


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, f"{obj_type}s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"
