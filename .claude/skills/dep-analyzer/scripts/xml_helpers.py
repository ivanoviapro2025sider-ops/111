"""XML-утилиты для парсинга конфигураций 1С."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from lxml import etree

# Пространства имён 1С XML-выгрузки
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

_XR_ALIASES = {NS_XR, NS_XR_ALT}


def _resolve_nsmap(element: Any, nsmap: Optional[dict] = None) -> dict:
    base = dict(nsmap or NSMAP)
    if element is None:
        return base
    node_nsmap = getattr(element, "nsmap", {}) or {}
    if base.get("xr") not in _XR_ALIASES:
        return base
    if NS_XR in node_nsmap.values():
        base["xr"] = NS_XR
    elif NS_XR_ALT in node_nsmap.values():
        base["xr"] = NS_XR_ALT
    return base


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Получить текст элемента по XPath. Безопасно при None/отсутствии."""

    if element is None:
        return default
    namespaces = _resolve_nsmap(element, nsmap)
    try:
        found = element.xpath(xpath, namespaces=namespaces)
        if not found:
            return default
        value = found[0]
        if hasattr(value, "text"):
            return (value.text or default).strip()
        return str(value).strip() or default
    except Exception:
        return default


def get_xml_elements(element: Any, xpath: str, nsmap: dict = None) -> list:
    """Получить список элементов по XPath."""

    if element is None:
        return []
    namespaces = _resolve_nsmap(element, nsmap)
    try:
        return element.xpath(xpath, namespaces=namespaces)
    except Exception:
        return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Безопасный парсинг XML-файла. Возвращает root или None."""

    if not os.path.exists(file_path):
        return None
    parser = etree.XMLParser(recover=True, remove_blank_text=False, huge_tree=True)
    try:
        tree = etree.parse(file_path, parser=parser)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


def local_name(tag_or_element: Any) -> str:
    """Вернуть локальное имя XML-тега."""

    if tag_or_element is None:
        return ""
    tag = getattr(tag_or_element, "tag", tag_or_element)
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.rsplit("}", 1)[-1]
    return tag


def normalize_type_name(raw_type: str) -> str:
    """Нормализовать QName-подобное имя типа к cfg:/xs:/v8:."""

    normalized = (raw_type or "").strip()
    if not normalized:
        return ""
    normalized = re.sub(r"^d\d+p\d+:", "cfg:", normalized)
    normalized = re.sub(r"^\w+:(?=(?:Catalog|Document|Enum|ChartOf|BusinessProcess|Task|ExchangePlan|"
                        r"InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister|"
                        r"DefinedType)\.)", "cfg:", normalized)
    normalized = re.sub(r"^\w+:(?=(?:string|decimal|boolean|dateTime)$)", "xs:", normalized)
    normalized = re.sub(r"^\w+:(?=(?:UUID|ValueStorage|Null|BinaryData)$)", "v8:", normalized)
    return normalized


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

_PRIMITIVE_TYPES = {
    "xs:string": ("Primitive", "String"),
    "xs:decimal": ("Primitive", "Number"),
    "xs:boolean": ("Primitive", "Boolean"),
    "xs:dateTime": ("Primitive", "Date"),
    "v8:ValueStorage": ("Primitive", "ValueStorage"),
    "v8:UUID": ("Primitive", "UUID"),
    "v8:Null": ("Primitive", "Null"),
    "v8:BinaryData": ("Primitive", "BinaryData"),
}


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Парсинг элемента v8:Type/v8:TypeSet.

    Возвращает {"type": ..., "name": ..., "full_type": ...} или None.
    """

    if type_element is None:
        return None

    raw_value = ""
    if hasattr(type_element, "text") and type_element.text:
        raw_value = type_element.text.strip()
    elif isinstance(type_element, str):
        raw_value = type_element.strip()

    if not raw_value:
        return None

    normalized = normalize_type_name(raw_value)

    for pattern, obj_type in _REF_PATTERNS:
        match = re.fullmatch(pattern, normalized)
        if match:
            return {
                "type": obj_type,
                "name": match.group(1),
                "full_type": normalized,
            }

    if normalized in _PRIMITIVE_TYPES:
        primitive_type, primitive_name = _PRIMITIVE_TYPES[normalized]
        return {
            "type": primitive_type,
            "name": primitive_name,
            "full_type": normalized,
        }

    defined_match = re.fullmatch(r"(?:cfg:)?DefinedType\.(\w+)", normalized)
    if defined_match:
        return {
            "type": "DefinedType",
            "name": defined_match.group(1),
            "full_type": normalized,
        }

    type_set_match = re.fullmatch(r"(?:cfg:)?TypeSet\.(\w+)", normalized)
    if type_set_match:
        return {
            "type": "TypeSet",
            "name": type_set_match.group(1),
            "full_type": normalized,
        }

    other_cfg_match = re.fullmatch(r"(?:cfg:)?(\w+)\.(\w+)", normalized)
    if other_cfg_match:
        return {
            "type": other_cfg_match.group(1),
            "name": other_cfg_match.group(2),
            "full_type": normalized,
        }

    return {
        "type": "Unknown",
        "name": normalized.split(".")[-1].split(":")[-1],
        "full_type": normalized,
    }


def parse_types_from_element(type_container: Any) -> list:
    """Извлечь все типы из контейнера <Type>."""

    if type_container is None:
        return []

    if isinstance(type_container, str):
        parsed = parse_type_value(type_container)
        return [parsed] if parsed else []

    namespaces = _resolve_nsmap(type_container)
    type_nodes = []
    current_name = local_name(type_container)
    if current_name in {"Type", "TypeSet"}:
        type_nodes.append(type_container)
    try:
        type_nodes.extend(type_container.xpath(".//v8:Type | .//v8:TypeSet", namespaces=namespaces))
    except Exception:
        pass

    seen = set()
    result: List[Dict[str, str]] = []
    for node in type_nodes:
        parsed = parse_type_value(node)
        if not parsed:
            continue
        key = (parsed["type"], parsed["name"], parsed["full_type"])
        if key in seen:
            continue
        seen.add(key)
        result.append(parsed)
    return result


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
