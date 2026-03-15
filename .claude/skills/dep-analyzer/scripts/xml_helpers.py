"""XML-утилиты для парсинга конфигураций 1С."""

import re
import os
from typing import Optional, Dict, List, Any
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

NSMAP_ALT = {
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


def _detect_nsmap(element) -> dict:
    """Определить правильный namespace map по содержимому XML-элемента."""
    if element is None:
        return NSMAP
    nsmap = element.nsmap if hasattr(element, 'nsmap') else {}
    for prefix, uri in nsmap.items():
        if uri == NS_XR_ALT:
            return NSMAP_ALT
    return NSMAP


def get_xml_text(element, xpath: str, default: str = "", nsmap: dict = None) -> str:
    """Получить текст элемента по XPath. Безопасно при None/отсутствии."""
    if element is None:
        return default
    ns = nsmap or _detect_nsmap(element)
    try:
        found = element.xpath(xpath, namespaces=ns)
        if found:
            if hasattr(found[0], 'text'):
                return (found[0].text or default).strip()
            return str(found[0]).strip() or default
    except Exception:
        pass
    return default


def get_xml_elements(element, xpath: str, nsmap: dict = None) -> list:
    """Получить список элементов по XPath."""
    if element is None:
        return []
    ns = nsmap or _detect_nsmap(element)
    try:
        return element.xpath(xpath, namespaces=ns)
    except Exception:
        return []


def parse_xml_file(file_path: str) -> Optional[etree._Element]:
    """Безопасный парсинг XML-файла. Возвращает root или None."""
    if not os.path.exists(file_path):
        return None
    try:
        tree = etree.parse(file_path)
        return tree.getroot()
    except Exception as e:
        print(f"[WARNING] Error parsing {file_path}: {e}")
        return None


_REF_PATTERNS = [
    (re.compile(r"(?:cfg:)?CatalogRef\.(\w+)"), "Catalog"),
    (re.compile(r"(?:cfg:)?DocumentRef\.(\w+)"), "Document"),
    (re.compile(r"(?:cfg:)?EnumRef\.(\w+)"), "Enum"),
    (re.compile(r"(?:cfg:)?ChartOfCharacteristicTypesRef\.(\w+)"), "ChartOfCharacteristicTypes"),
    (re.compile(r"(?:cfg:)?ChartOfAccountsRef\.(\w+)"), "ChartOfAccounts"),
    (re.compile(r"(?:cfg:)?ChartOfCalculationTypesRef\.(\w+)"), "ChartOfCalculationTypes"),
    (re.compile(r"(?:cfg:)?BusinessProcessRef\.(\w+)"), "BusinessProcess"),
    (re.compile(r"(?:cfg:)?TaskRef\.(\w+)"), "Task"),
    (re.compile(r"(?:cfg:)?ExchangePlanRef\.(\w+)"), "ExchangePlan"),
    (re.compile(r"(?:cfg:)?InformationRegisterRecordKey\.(\w+)"), "InformationRegister"),
    (re.compile(r"(?:cfg:)?AccumulationRegisterRecordKey\.(\w+)"), "AccumulationRegister"),
]

_PRIMITIVE_TYPES = {
    "xs:string", "xs:boolean", "xs:decimal", "xs:dateTime",
    "v8:UUID", "xs:base64Binary", "xs:integer",
    "cfg:String", "cfg:Boolean", "cfg:Number", "cfg:Date",
}

_DEFINED_TYPE_RE = re.compile(r"(?:cfg:)?DefinedType\.(\w+)")


def parse_type_value(type_text: str) -> Optional[Dict[str, str]]:
    """Парсинг текстового значения типа.
    Возвращает {'type': ..., 'name': ..., 'full_type': ...} или None.
    """
    if not type_text:
        return None
    type_text = type_text.strip()

    for pattern, obj_type in _REF_PATTERNS:
        m = pattern.match(type_text)
        if m:
            name = m.group(1)
            return {
                "type": obj_type,
                "name": name,
                "full_type": f"{obj_type}Ref.{name}",
            }

    m = _DEFINED_TYPE_RE.match(type_text)
    if m:
        name = m.group(1)
        return {
            "type": "DefinedType",
            "name": name,
            "full_type": f"DefinedType.{name}",
        }

    if type_text in _PRIMITIVE_TYPES:
        return {
            "type": "Primitive",
            "name": type_text,
            "full_type": type_text,
        }

    return {
        "type": "Unknown",
        "name": type_text,
        "full_type": type_text,
    }


def parse_types_from_element(type_container) -> List[Dict[str, str]]:
    """Извлечь все типы из контейнера <Type> (может содержать v8:Type и v8:TypeSet)."""
    if type_container is None:
        return []

    results = []
    ns = _detect_nsmap(type_container)

    type_elems = get_xml_elements(type_container, ".//v8:Type", nsmap=ns)
    for te in type_elems:
        text = te.text
        if text:
            parsed = parse_type_value(text.strip())
            if parsed:
                results.append(parsed)

    type_set_elems = get_xml_elements(type_container, ".//v8:TypeSet", nsmap=ns)
    for ts in type_set_elems:
        text = ts.text
        if text:
            parsed = parse_type_value(text.strip())
            if parsed:
                results.append(parsed)

    if not results:
        for child in type_container:
            tag = etree.QName(child.tag).localname if isinstance(child.tag, str) else ""
            if tag in ("Type", "TypeSet") and child.text:
                parsed = parse_type_value(child.text.strip())
                if parsed:
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

FOLDER_TO_TYPE = {v: k for k, v in TYPE_TO_FOLDER.items()}

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
    "WebService": "Web-сервис",
}


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, obj_type + "s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"


def find_object_xml(config_path: str, obj_type: str, name: str) -> Optional[str]:
    """Найти основной XML-файл объекта метаданных."""
    folder = get_type_folder(obj_type)
    xml_path = os.path.join(config_path, folder, name + ".xml")
    if os.path.exists(xml_path):
        return xml_path

    xml_path_alt = os.path.join(config_path, folder, name, name + ".xml")
    if os.path.exists(xml_path_alt):
        return xml_path_alt

    return None


def find_object_dir(config_path: str, obj_type: str, name: str) -> Optional[str]:
    """Найти каталог объекта метаданных."""
    folder = get_type_folder(obj_type)

    obj_dir = os.path.join(config_path, folder, name)
    if os.path.isdir(obj_dir):
        return obj_dir

    return None
