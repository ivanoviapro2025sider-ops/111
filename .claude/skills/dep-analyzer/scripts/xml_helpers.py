"""XML-утилиты для парсинга конфигураций 1С"""

import re
import os
from typing import Optional, Dict, List, Any
from lxml import etree

from models import TypeRef

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
    """Auto-detect the XR namespace variant used in the document."""
    if element is None:
        return NSMAP
    nsmap = element.nsmap if hasattr(element, 'nsmap') else {}
    for uri in nsmap.values():
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
    (re.compile(r"(?:cfg:)?CatalogRef\.(\w+)"), "Catalog", "CatalogRef"),
    (re.compile(r"(?:cfg:)?DocumentRef\.(\w+)"), "Document", "DocumentRef"),
    (re.compile(r"(?:cfg:)?EnumRef\.(\w+)"), "Enum", "EnumRef"),
    (re.compile(r"(?:cfg:)?ChartOfCharacteristicTypesRef\.(\w+)"), "ChartOfCharacteristicTypes", "ChartOfCharacteristicTypesRef"),
    (re.compile(r"(?:cfg:)?ChartOfAccountsRef\.(\w+)"), "ChartOfAccounts", "ChartOfAccountsRef"),
    (re.compile(r"(?:cfg:)?ChartOfCalculationTypesRef\.(\w+)"), "ChartOfCalculationTypes", "ChartOfCalculationTypesRef"),
    (re.compile(r"(?:cfg:)?BusinessProcessRef\.(\w+)"), "BusinessProcess", "BusinessProcessRef"),
    (re.compile(r"(?:cfg:)?TaskRef\.(\w+)"), "Task", "TaskRef"),
    (re.compile(r"(?:cfg:)?ExchangePlanRef\.(\w+)"), "ExchangePlan", "ExchangePlanRef"),
    (re.compile(r"(?:cfg:)?InformationRegisterRecordKey\.(\w+)"), "InformationRegister", "InformationRegisterRecordKey"),
    (re.compile(r"(?:cfg:)?AccumulationRegisterRecordKey\.(\w+)"), "AccumulationRegister", "AccumulationRegisterRecordKey"),
]

_PRIMITIVE_TYPES = {
    "xs:string", "xs:boolean", "xs:decimal", "xs:dateTime",
    "xs:integer", "xs:long", "xs:int", "xs:double", "xs:float",
    "xs:date", "xs:time", "xs:base64Binary",
    "v8:UUID", "v8:Null", "v8:ValueStorage", "v8:StandardPeriod",
    "v8:StandardBeginningDate", "v8:PointInTime",
    "cfg:String", "cfg:Number", "cfg:Boolean", "cfg:Date",
    "String", "Number", "Boolean", "Date",
}

_DEFINED_TYPE_PATTERN = re.compile(r"(?:cfg:)?DefinedType\.(\w+)")


def parse_type_value(type_text: str) -> Optional[TypeRef]:
    """Парсинг текстового значения типа.
    Возвращает TypeRef или None (для примитивов и нераспознанных типов).
    """
    if not type_text:
        return None

    type_text = type_text.strip()

    if type_text in _PRIMITIVE_TYPES:
        return None

    for pattern, obj_type, ref_prefix in _REF_PATTERNS:
        m = pattern.fullmatch(type_text)
        if m:
            name = m.group(1)
            return TypeRef(
                obj_type=obj_type,
                name=name,
                full_type=f"{ref_prefix}.{name}",
            )

    m = _DEFINED_TYPE_PATTERN.fullmatch(type_text)
    if m:
        name = m.group(1)
        return TypeRef(
            obj_type="DefinedType",
            name=name,
            full_type=f"DefinedType.{name}",
        )

    return None


def parse_types_from_element(type_container) -> List[TypeRef]:
    """Извлечь все TypeRef из контейнера <Type> / <TypeDescription>.
    Ищет дочерние v8:Type и v8:TypeSet элементы.
    """
    if type_container is None:
        return []

    results: List[TypeRef] = []
    ns = _detect_nsmap(type_container)

    type_elements = get_xml_elements(type_container, ".//v8:Type", nsmap=ns)
    if not type_elements:
        type_elements = get_xml_elements(type_container, ".//Type")

    for te in type_elements:
        text = (te.text or "").strip()
        ref = parse_type_value(text)
        if ref:
            results.append(ref)

    typeset_elements = get_xml_elements(type_container, ".//v8:TypeSet", nsmap=ns)
    for ts in typeset_elements:
        text = (ts.text or "").strip()
        ref = parse_type_value(text)
        if ref:
            results.append(ref)

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

FOLDER_TO_TYPE = {v: k for k, v in TYPE_TO_FOLDER.items()}


def get_type_folder(obj_type: str) -> str:
    return TYPE_TO_FOLDER.get(obj_type, obj_type + "s")


def get_type_ru(obj_type: str) -> str:
    return TYPE_TO_RU.get(obj_type, obj_type)


def get_full_object_key(obj_type: str, name: str) -> str:
    return f"{obj_type}.{name}"


def split_object_key(key: str) -> tuple:
    """Split 'Document.РеализацияТоваровУслуг' into ('Document', 'РеализацияТоваровУслуг')."""
    parts = key.split(".", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return key, ""
