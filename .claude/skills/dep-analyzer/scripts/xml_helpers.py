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
    """Run XPath and retry with alternative XR namespace if needed."""
    try:
        result = element.xpath(xpath, namespaces=nsmap)
    except Exception:
        return []
    if result or "xr:" not in xpath:
        return result
    try:
        return element.xpath(xpath, namespaces={**nsmap, "xr": NS_XR_ALT})
    except Exception:
        return []


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: Dict[str, str] | None = None) -> str:
    """Получить текст элемента по XPath. Безопасно при None/отсутствии."""
    if element is None:
        return default
    ns = nsmap or NSMAP
    found = _xpath_with_xr_fallback(element, xpath, ns)
    if not found:
        return default
    first = found[0]
    if hasattr(first, "text"):
        value = first.text
        return (value or default).strip() if isinstance(value, str) else (value or default)
    value = str(first) if first is not None else default
    return value.strip() if isinstance(value, str) else value


def get_xml_elements(element: Any, xpath: str, nsmap: Dict[str, str] | None = None) -> List[Any]:
    """Получить список элементов по XPath."""
    if element is None:
        return []
    ns = nsmap or NSMAP
    return _xpath_with_xr_fallback(element, xpath, ns)


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Безопасный парсинг XML-файла. Возвращает root или None."""
    if not os.path.exists(file_path):
        return None
    try:
        parser = etree.XMLParser(resolve_entities=False, recover=True, huge_tree=True)
        tree = etree.parse(file_path, parser=parser)
        return tree.getroot()
    except Exception as exc:  # pragma: no cover - best effort logging
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

_PRIMITIVES = {
    "String",
    "Number",
    "Boolean",
    "Date",
    "Undefined",
    "Null",
    "Type",
    "UUID",
    "ValueStorage",
    "BinaryData",
    "AnyRef",
}


def _extract_type_raw_value(type_element: Any) -> str:
    if type_element is None:
        return ""
    if isinstance(type_element, str):
        return type_element.strip()

    text_nodes = [txt.strip() for txt in type_element.itertext() if txt and txt.strip()]
    if text_nodes:
        return " ".join(text_nodes)

    value_attr = type_element.get("value")
    if value_attr:
        return value_attr.strip()

    xsi_type = type_element.get(f"{{{NS_XSI}}}type")
    if xsi_type:
        return xsi_type.strip()

    return ""


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Парсинг элемента v8:Type.

    Возвращает {"type": ..., "name": ..., "full_type": ...} или None.
    """
    raw = _extract_type_raw_value(type_element)
    if not raw:
        return None

    normalized = re.sub(r"\s+", "", raw)
    normalized = normalized.strip(";")

    for pattern, obj_type in _REF_PATTERNS:
        match = re.search(pattern, normalized)
        if match:
            name = match.group(1)
            return {"type": obj_type, "name": name, "full_type": normalized}

    defined_match = re.search(r"(?:cfg:)?DefinedType\.([A-Za-zА-Яа-я0-9_]+)", normalized)
    if defined_match:
        return {
            "type": "DefinedType",
            "name": defined_match.group(1),
            "full_type": normalized,
        }

    short_name = normalized.split(".")[-1]
    if short_name in _PRIMITIVES:
        return {"type": "Primitive", "name": short_name, "full_type": normalized}

    # v8:TypeSet может передавать значения вроде "cfg:TypeDescription.String"
    primitive_match = re.search(
        r"(?:cfg:)?TypeDescription\.([A-Za-zА-Яа-я0-9_]+)", normalized
    )
    if primitive_match and primitive_match.group(1) in _PRIMITIVES:
        prim = primitive_match.group(1)
        return {"type": "Primitive", "name": prim, "full_type": normalized}

    return {"type": "Unknown", "name": short_name, "full_type": normalized}


def parse_types_from_element(type_container: Any) -> List[Dict[str, str]]:
    """Извлечь все типы из контейнера <Type>.

    Поддерживаются варианты:
    - одиночный <v8:Type>
    - несколько <v8:Type> внутри <v8:TypeSet>
    - текстовые значения, разделённые ';' или ','
    """
    if type_container is None:
        return []

    found_types: List[Dict[str, str]] = []
    seen: set[str] = set()

    candidates: List[Any] = []
    nested_types = get_xml_elements(type_container, ".//v8:Type", NSMAP)
    if not nested_types:
        nested_types = get_xml_elements(type_container, ".//*[local-name()='Type']")

    # Если в контейнере нет вложенных Type-элементов, пытаемся распарсить его напрямую.
    if not nested_types and hasattr(type_container, "tag") and str(type_container.tag).endswith("Type"):
        candidates.append(type_container)
    else:
        candidates.extend(nested_types)

    # Фоллбэк для текстового контейнера без дочерних Type
    if not nested_types:
        raw_text = _extract_type_raw_value(type_container)
        if raw_text:
            for chunk in re.split(r"[;,]", raw_text):
                chunk = chunk.strip()
                if chunk:
                    candidates.append(chunk)

    for candidate in candidates:
        parsed = parse_type_value(candidate)
        if not parsed:
            continue
        full_type = parsed.get("full_type", "")
        if full_type and full_type not in seen:
            seen.add(full_type)
            found_types.append(parsed)

    return found_types


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
