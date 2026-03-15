"""XML-утилиты для парсинга конфигураций 1С."""

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


def _xpath_with_xr_fallback(element: Any, xpath: str, nsmap: Optional[dict]) -> list:
    """Выполнить XPath-запрос с фолбэком на альтернативный namespace XR."""
    ns = nsmap or NSMAP
    result = element.xpath(xpath, namespaces=ns)
    if result:
        return result

    # Фолбэк только для дефолтной карты имён (может быть v8.3/xcf/readable).
    if nsmap is None:
        try:
            return element.xpath(xpath, namespaces=NSMAP_ALT_XR)
        except Exception:
            return []
    return []


def get_xml_text(element: Any, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Получить текст элемента по XPath. Безопасно при None/отсутствии."""
    if element is None:
        return default
    try:
        found = _xpath_with_xr_fallback(element, xpath, nsmap)
        if found:
            value = found[0]
            if hasattr(value, "text"):
                return (value.text or default).strip()
            return (str(value) or default).strip()
    except Exception:
        pass
    return default


def get_xml_elements(element: Any, xpath: str, nsmap: dict = None) -> list:
    """Получить список элементов по XPath."""
    if element is None:
        return []
    try:
        return _xpath_with_xr_fallback(element, xpath, nsmap)
    except Exception:
        return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Безопасный парсинг XML-файла. Возвращает root или None."""
    if not os.path.exists(file_path):
        return None
    try:
        tree = etree.parse(file_path)
        return tree.getroot()
    except Exception as exc:
        print(f"[WARNING] Error parsing {file_path}: {exc}")
        return None


# Паттерны для определения ссылочных типов (поддержка Cyrillic в именах)
_REF_PATTERNS = [
    (r"(?:cfg:)?CatalogRef\.([\wА-Яа-яЁё]+)", "Catalog"),
    (r"(?:cfg:)?DocumentRef\.([\wА-Яа-яЁё]+)", "Document"),
    (r"(?:cfg:)?EnumRef\.([\wА-Яа-яЁё]+)", "Enum"),
    (r"(?:cfg:)?ChartOfCharacteristicTypesRef\.([\wА-Яа-яЁё]+)", "ChartOfCharacteristicTypes"),
    (r"(?:cfg:)?ChartOfAccountsRef\.([\wА-Яа-яЁё]+)", "ChartOfAccounts"),
    (r"(?:cfg:)?ChartOfCalculationTypesRef\.([\wА-Яа-яЁё]+)", "ChartOfCalculationTypes"),
    (r"(?:cfg:)?BusinessProcessRef\.([\wА-Яа-яЁё]+)", "BusinessProcess"),
    (r"(?:cfg:)?TaskRef\.([\wА-Яа-яЁё]+)", "Task"),
    (r"(?:cfg:)?ExchangePlanRef\.([\wА-Яа-яЁё]+)", "ExchangePlan"),
    (r"(?:cfg:)?InformationRegisterRecordKey\.([\wА-Яа-яЁё]+)", "InformationRegister"),
    (r"(?:cfg:)?AccumulationRegisterRecordKey\.([\wА-Яа-яЁё]+)", "AccumulationRegister"),
]

_DEFINED_TYPE_PATTERNS = [
    r"(?:cfg:)?DefinedType\.([\wА-Яа-яЁё]+)",
    r"(?:cfg:)?Type\.([\wА-Яа-яЁё]+)",
]

_PRIMITIVE_TYPES = {
    "string": "String",
    "number": "Number",
    "date": "Date",
    "boolean": "Boolean",
    "uuid": "UUID",
    "valuestorage": "ValueStorage",
    "binarydata": "BinaryData",
    "type": "Type",
    "anyref": "AnyRef",
}


def _normalize_type_string(value: str) -> str:
    """Удалить лишние пробелы из строки типа."""
    return re.sub(r"\s+", "", value or "")


def parse_type_value(type_element: Any) -> Optional[Dict[str, str]]:
    """Парсинг элемента v8:Type.

    Возвращает словарь {'type': ..., 'name': ..., 'full_type': ...} или None.
    Пробует: все _REF_PATTERNS → DefinedType → примитивы → Unknown.
    """
    if type_element is None:
        return None

    candidates: List[str] = []

    # Текстовое содержимое элемента
    text = (getattr(type_element, "text", "") or "").strip()
    if text:
        candidates.append(text)

    # Flatten nested text (на случай вложенных элементов)
    try:
        flattened = str(type_element.xpath("string(.)")).strip()
        if flattened:
            candidates.append(flattened)
    except Exception:
        pass

    # Атрибуты
    for attr_name in ("type", "name", f"{{{NS_XSI}}}type"):
        attr_val = type_element.attrib.get(attr_name)
        if attr_val:
            candidates.append(attr_val)

    # Дедупликация с сохранением порядка
    seen: set = set()
    deduped_candidates: List[str] = []
    for item in candidates:
        norm = _normalize_type_string(item)
        if norm and norm not in seen:
            seen.add(norm)
            deduped_candidates.append(norm)

    for value in deduped_candidates:
        # Ссылочные типы
        for pattern, obj_type in _REF_PATTERNS:
            match = re.search(pattern, value)
            if match:
                name = match.group(1)
                full_type = re.sub(r"^cfg:", "", match.group(0))
                return {"type": obj_type, "name": name, "full_type": full_type}

        # DefinedType
        for defined_pattern in _DEFINED_TYPE_PATTERNS:
            match = re.search(defined_pattern, value)
            if match:
                name = match.group(1)
                full_type = re.sub(r"^cfg:", "", match.group(0))
                return {"type": "DefinedType", "name": name, "full_type": full_type}

        # Примитивы
        simple = value.lower().replace("cfg:", "")
        if simple in _PRIMITIVE_TYPES:
            primitive_name = _PRIMITIVE_TYPES[simple]
            return {"type": "Primitive", "name": primitive_name, "full_type": primitive_name}

    # Unknown fallback
    if deduped_candidates:
        unknown = deduped_candidates[0]
        return {"type": "Unknown", "name": unknown, "full_type": unknown}
    return None


def parse_types_from_element(type_container: Any) -> list:
    """Извлечь все типы из контейнера <Type> / <TypeSet>.

    Может содержать несколько v8:Type и v8:TypeSet.
    """
    if type_container is None:
        return []

    parsed_types: List[Dict[str, str]] = []
    seen: set = set()

    # Собираем все потенциальные узлы типов
    candidate_nodes: List[Any] = []
    candidate_nodes.extend(get_xml_elements(type_container, ".//v8:Type"))
    candidate_nodes.extend(get_xml_elements(type_container, ".//*[local-name()='Type']"))
    candidate_nodes.extend(get_xml_elements(type_container, ".//*[local-name()='TypeSet']"))

    if not candidate_nodes:
        candidate_nodes.append(type_container)

    for node in candidate_nodes:
        info = parse_type_value(node)
        if info is None:
            continue
        key = (info["type"], info["name"], info["full_type"])
        if key in seen:
            continue
        seen.add(key)
        parsed_types.append(info)

    return parsed_types


# Маппинг типов объектов → имена папок в выгрузке
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

# Маппинг типов → русские названия
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
    """Получить имя папки по типу объекта."""
    return TYPE_TO_FOLDER.get(obj_type, obj_type + "s")


def get_type_ru(obj_type: str) -> str:
    """Получить русское название типа объекта."""
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    """Получить полный ключ объекта: 'Тип.Имя'."""
    return f"{obj_type}.{name}"
