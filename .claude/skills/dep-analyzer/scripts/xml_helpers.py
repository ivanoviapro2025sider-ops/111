"""XML-утилиты для парсинга конфигураций 1С."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from lxml import etree

# Пространства имён 1С XML-выгрузки
NS_MD = "http://v8.1c.ru/8.3/MDClasses"
NS_V8 = "http://v8.1c.ru/8.1/data/core"
NS_XR = "http://v8.1c.ru/8.3/xcf/readable"  # NB: иногда используется короткий xr namespace.
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
    **NSMAP,
    "xr": NS_XR_ALT,
}

NSMAP_ROLES = {
    "r": NS_ROLES,
    "xs": "http://www.w3.org/2001/XMLSchema",
    "xsi": NS_XSI,
}


def _xpath_with_xr_fallback(element: Any, xpath: str, nsmap: Dict[str, str]) -> List[Any]:
    """Evaluate xpath using default xr namespace, then alternate xr if needed."""
    found = element.xpath(xpath, namespaces=nsmap)
    if found:
        return found
    if nsmap.get("xr") == NS_XR:
        return element.xpath(xpath, namespaces=NSMAP_ALT_XR)
    return found


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: Dict[str, str] = None) -> str:
    """Получить текст элемента по XPath. Безопасно при None/отсутствии."""
    if element is None:
        return default

    ns = nsmap or NSMAP
    try:
        found = _xpath_with_xr_fallback(element, xpath, ns)
        if not found:
            return default
        value = found[0]
        if hasattr(value, "text"):
            return (value.text or default).strip()
        return str(value).strip() or default
    except Exception:
        return default


def get_xml_elements(element: Any, xpath: str, nsmap: Dict[str, str] = None) -> List[Any]:
    """Получить список элементов по XPath."""
    if element is None:
        return []
    ns = nsmap or NSMAP
    try:
        return _xpath_with_xr_fallback(element, xpath, ns)
    except Exception:
        return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Безопасный парсинг XML-файла. Возвращает root или None."""
    if not os.path.exists(file_path):
        return None
    try:
        parser = etree.XMLParser(remove_blank_text=False, recover=True, huge_tree=True)
        tree = etree.parse(file_path, parser=parser)
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
]

_PRIMITIVE_PREFIXES = {
    "String",
    "Number",
    "Boolean",
    "Date",
    "DateTime",
    "BinaryData",
    "UUID",
    "ValueStorage",
}


def _extract_type_text(type_element: Any) -> str:
    if type_element is None:
        return ""
    if hasattr(type_element, "text") and type_element.text:
        text = type_element.text.strip()
        if text:
            return text
    for xpath in ("./text()", ".//text()"):
        values = get_xml_elements(type_element, xpath)
        text = " ".join(str(v).strip() for v in values if str(v).strip())
        if text:
            return text
    return ""


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Парсинг v8:Type.

    Returns {'type': ..., 'name': ..., 'full_type': ...} or None.
    """
    raw = _extract_type_text(type_element)
    if not raw:
        return None

    raw = raw.replace("\n", " ").replace("\t", " ").strip()
    for pattern, obj_type in _REF_PATTERNS:
        match = re.search(pattern, raw)
        if match:
            return {"type": obj_type, "name": match.group(1), "full_type": raw}

    # DefinedType reference frequently appears as cfg:Type.<Name> or DefinedType.<Name>
    defined_type_match = re.search(r"(?:cfg:)?(?:Type|DefinedType)\.([A-Za-zА-Яа-я0-9_]+)", raw)
    if defined_type_match:
        return {"type": "DefinedType", "name": defined_type_match.group(1), "full_type": raw}

    # Primitive types: keep as pseudo type with own name for display.
    for primitive in _PRIMITIVE_PREFIXES:
        if raw.startswith(f"v8:{primitive}") or raw.startswith(f"cfg:{primitive}") or raw.startswith(primitive):
            return {"type": "Primitive", "name": primitive, "full_type": raw}

    return {"type": "Unknown", "name": raw, "full_type": raw}


def parse_types_from_element(type_container: Any) -> List[Dict[str, str]]:
    """Извлечь все типы из контейнера <Type> или <TypeSet>."""
    if type_container is None:
        return []

    parsed: List[Dict[str, str]] = []

    # 1) Direct <v8:Type> descendants.
    for type_element in get_xml_elements(type_container, ".//v8:Type"):
        value = parse_type_value(type_element)
        if value:
            parsed.append(value)

    # 2) Some exports use bare tags without namespace.
    for type_element in get_xml_elements(type_container, ".//*[local-name()='Type']"):
        value = parse_type_value(type_element)
        if value:
            parsed.append(value)

    # 3) If the container itself is a type node.
    self_value = parse_type_value(type_container)
    if self_value:
        parsed.append(self_value)

    dedup: Dict[str, Dict[str, str]] = {}
    for item in parsed:
        key = f"{item.get('type')}:{item.get('name')}:{item.get('full_type')}"
        dedup[key] = item
    return list(dedup.values())


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
