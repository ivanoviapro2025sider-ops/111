"""Сканирование Configuration.xml и построение индекса объектов метаданных."""

import os
from typing import Dict, List, Optional

from models import ObjectInfo, ObjectType
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    get_type_folder, NSMAP, TYPE_TO_FOLDER, FOLDER_TO_TYPE,
)

_CHILD_OBJECTS_TAG = "{http://v8.1c.ru/8.3/MDClasses}ChildObjects"

_XML_TAG_TO_TYPE = {
    "Catalog": "Catalog",
    "Document": "Document",
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
    "Enum": "Enum",
    "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ChartOfAccounts": "ChartOfAccounts",
    "ChartOfCalculationTypes": "ChartOfCalculationTypes",
    "BusinessProcess": "BusinessProcess",
    "Task": "Task",
    "ExchangePlan": "ExchangePlan",
    "Report": "Report",
    "DataProcessor": "DataProcessor",
    "CommonModule": "CommonModule",
    "EventSubscription": "EventSubscription",
    "Role": "Role",
    "Constant": "Constant",
    "DocumentJournal": "DocumentJournal",
    "ScheduledJob": "ScheduledJob",
    "DefinedType": "DefinedType",
    "HTTPService": "HTTPService",
    "WebService": "WebService",
}


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Сканировать конфигурацию и вернуть индекс объектов.

    config_path: путь к корню XML-выгрузки (каталог, содержащий Configuration.xml)
    Returns: dict {\"Catalog.Номенклатура\": ObjectInfo, ...}
    """
    index: Dict[str, ObjectInfo] = {}

    config_xml = os.path.join(config_path, "Configuration.xml")
    if os.path.exists(config_xml):
        index.update(_scan_from_configuration_xml(config_path, config_xml))

    _scan_from_filesystem(config_path, index)

    return index


def _scan_from_configuration_xml(config_path: str, config_xml: str) -> Dict[str, ObjectInfo]:
    """Парсинг Configuration.xml для получения списка объектов."""
    result: Dict[str, ObjectInfo] = {}

    root = parse_xml_file(config_xml)
    if root is None:
        return result

    child_objects = None
    for child in root:
        local = _local_tag(child.tag)
        if local == "ChildObjects":
            child_objects = child
            break

    if child_objects is None:
        child_objects_list = get_xml_elements(root, ".//md:ChildObjects")
        if child_objects_list:
            child_objects = child_objects_list[0]

    if child_objects is None:
        return result

    for elem in child_objects:
        local = _local_tag(elem.tag)
        obj_type = _XML_TAG_TO_TYPE.get(local)
        if obj_type and elem.text:
            name = elem.text.strip()
            if name:
                key = f"{obj_type}.{name}"
                obj_path = _resolve_object_path(config_path, obj_type, name)
                result[key] = ObjectInfo(
                    name=name,
                    obj_type=obj_type,
                    path=obj_path,
                )

    return result


def _scan_from_filesystem(config_path: str, index: Dict[str, ObjectInfo]):
    """Дополнить индекс из файловой системы (обнаружить объекты, отсутствующие в Configuration.xml)."""
    for obj_type, folder_name in TYPE_TO_FOLDER.items():
        folder_path = os.path.join(config_path, folder_name)
        if not os.path.isdir(folder_path):
            continue

        for entry in os.listdir(folder_path):
            name = _strip_xml_ext(entry)
            if not name:
                continue
            key = f"{obj_type}.{name}"
            if key not in index:
                obj_path = _resolve_object_path(config_path, obj_type, name)
                index[key] = ObjectInfo(
                    name=name,
                    obj_type=obj_type,
                    path=obj_path,
                )


def _resolve_object_path(config_path: str, obj_type: str, name: str) -> str:
    """Определить абсолютный путь к каталогу/файлу объекта."""
    folder = get_type_folder(obj_type)

    obj_dir = os.path.join(config_path, folder, name)
    if os.path.isdir(obj_dir):
        return obj_dir

    xml_file = os.path.join(config_path, folder, name + ".xml")
    if os.path.exists(xml_file):
        return xml_file

    return os.path.join(config_path, folder, name)


def _local_tag(tag: str) -> str:
    """Извлечь локальное имя из тега с namespace."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _strip_xml_ext(filename: str) -> str:
    """Убрать расширение .xml из имени файла, или вернуть имя каталога."""
    if filename.endswith(".xml"):
        return filename[:-4]
    if not filename.startswith(".") and "." not in filename:
        return filename
    return ""


def find_bsl_modules(obj_path: str) -> List[str]:
    """Найти все BSL-модули объекта по его каталогу."""
    result: List[str] = []
    if not os.path.isdir(obj_path):
        return result

    for root, dirs, files in os.walk(obj_path):
        for f in files:
            if f.lower().endswith(".bsl"):
                result.append(os.path.join(root, f))
    return result


def find_object_main_xml(config_path: str, obj_type: str, name: str) -> Optional[str]:
    """Найти основной XML-файл описания объекта."""
    folder = get_type_folder(obj_type)

    candidates = [
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, folder, name, name + ".xml"),
        os.path.join(config_path, folder, name, "Ext", "ObjectModule.xml"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None
