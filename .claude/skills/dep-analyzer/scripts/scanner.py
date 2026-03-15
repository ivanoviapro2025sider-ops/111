"""Сканирование Configuration.xml + построение индекса объектов конфигурации."""

import os
from typing import Dict, List, Optional

from models import ObjectInfo, ObjectType
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    get_type_folder, get_full_object_key, NSMAP, _detect_nsmap,
)

_CONFIG_XML_TAGS = {
    "Catalog": ObjectType.CATALOG,
    "Document": ObjectType.DOCUMENT,
    "InformationRegister": ObjectType.INFORMATION_REGISTER,
    "AccumulationRegister": ObjectType.ACCUMULATION_REGISTER,
    "AccountingRegister": ObjectType.ACCOUNTING_REGISTER,
    "CalculationRegister": ObjectType.CALCULATION_REGISTER,
    "Enum": ObjectType.ENUM,
    "ChartOfCharacteristicTypes": ObjectType.CHART_OF_CHARACTERISTIC_TYPES,
    "ChartOfAccounts": ObjectType.CHART_OF_ACCOUNTS,
    "ChartOfCalculationTypes": ObjectType.CHART_OF_CALCULATION_TYPES,
    "BusinessProcess": ObjectType.BUSINESS_PROCESS,
    "Task": ObjectType.TASK,
    "ExchangePlan": ObjectType.EXCHANGE_PLAN,
    "Report": ObjectType.REPORT,
    "DataProcessor": ObjectType.DATA_PROCESSOR,
    "CommonModule": ObjectType.COMMON_MODULE,
    "EventSubscription": ObjectType.EVENT_SUBSCRIPTION,
    "Role": ObjectType.ROLE,
    "Constant": ObjectType.CONSTANT,
    "DocumentJournal": ObjectType.DOCUMENT_JOURNAL,
    "ScheduledJob": ObjectType.SCHEDULED_JOB,
    "DefinedType": ObjectType.DEFINED_TYPE,
    "HTTPService": ObjectType.HTTP_SERVICE,
    "WebService": ObjectType.WEB_SERVICE,
}


def find_configuration_xml(config_path: str) -> Optional[str]:
    """Найти Configuration.xml в каталоге конфигурации."""
    direct = os.path.join(config_path, "Configuration.xml")
    if os.path.exists(direct):
        return direct

    conf_dir = os.path.join(config_path, "Configuration")
    if os.path.isdir(conf_dir):
        candidate = os.path.join(conf_dir, "Configuration.xml")
        if os.path.exists(candidate):
            return candidate

    for root_dir, dirs, files in os.walk(config_path):
        if "Configuration.xml" in files:
            return os.path.join(root_dir, "Configuration.xml")
        if root_dir.count(os.sep) - config_path.count(os.sep) > 2:
            break

    return None


def _extract_child_objects(root, obj_type_tag: str, nsmap: dict) -> List[str]:
    """Извлечь имена дочерних объектов определённого типа из Configuration.xml."""
    results = []

    xpaths = [
        f".//md:ChildObjects/md:{obj_type_tag}",
        f".//md:{obj_type_tag}",
        f".//{{{nsmap.get('md', '')}}}{obj_type_tag}",
    ]

    for xpath in xpaths:
        try:
            elements = root.xpath(xpath, namespaces=nsmap)
            if elements:
                for el in elements:
                    name = el.text
                    if name and name.strip():
                        results.append(name.strip())
                if results:
                    break
        except Exception:
            continue

    return results


def _resolve_object_path(config_path: str, obj_type: str, name: str) -> str:
    """Определить путь к каталогу объекта."""
    folder = get_type_folder(obj_type)

    candidates = [
        os.path.join(config_path, folder, name),
        os.path.join(config_path, folder, name + ".xml"),
        os.path.join(config_path, obj_type, name),
    ]

    for c in candidates:
        if os.path.exists(c):
            return c

    return os.path.join(config_path, folder, name)


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Сканировать Configuration.xml и построить индекс всех объектов.

    Returns:
        Dict[str, ObjectInfo]: ключ = "ObjectType.Name", значение = ObjectInfo
    """
    config_xml_path = find_configuration_xml(config_path)
    if not config_xml_path:
        print(f"[ERROR] Configuration.xml not found in {config_path}")
        return {}

    root = parse_xml_file(config_xml_path)
    if root is None:
        print(f"[ERROR] Failed to parse {config_xml_path}")
        return {}

    nsmap = _detect_nsmap(root)
    config_dir = os.path.dirname(config_xml_path)
    if os.path.basename(config_dir) == "Configuration":
        config_dir = os.path.dirname(config_dir)

    objects: Dict[str, ObjectInfo] = {}

    for tag, obj_type_enum in _CONFIG_XML_TAGS.items():
        obj_type = obj_type_enum.value
        names = _extract_child_objects(root, tag, nsmap)

        for name in names:
            obj_path = _resolve_object_path(config_dir, obj_type, name)
            obj_info = ObjectInfo(
                name=name,
                obj_type=obj_type,
                path=obj_path,
            )
            key = get_full_object_key(obj_type, name)
            objects[key] = obj_info

    _enrich_from_object_xml(objects, config_dir, nsmap)

    return objects


def _enrich_from_object_xml(objects: Dict[str, ObjectInfo], config_dir: str, nsmap: dict):
    """Дополнить ObjectInfo базовыми свойствами из XML-файлов отдельных объектов."""
    for key, obj_info in objects.items():
        xml_candidates = [
            os.path.join(obj_info.path, f"{obj_info.name}.xml") if os.path.isdir(obj_info.path) else "",
            obj_info.path if obj_info.path.endswith(".xml") else "",
            os.path.join(obj_info.path + ".xml"),
        ]

        for xml_path in xml_candidates:
            if xml_path and os.path.isfile(xml_path):
                root = parse_xml_file(xml_path)
                if root is not None:
                    obj_nsmap = _detect_nsmap(root)
                    _read_basic_properties(obj_info, root, obj_nsmap)
                break


def _read_basic_properties(obj_info: ObjectInfo, root, nsmap: dict):
    """Прочитать базовые свойства: Synonym, Comment."""
    synonym_xpaths = [
        ".//md:Properties/md:Synonym/v8:item/v8:content",
        ".//md:Synonym/v8:item/v8:content",
        ".//md:Properties/md:Synonym",
    ]
    for xp in synonym_xpaths:
        val = get_xml_text(root, xp, nsmap=nsmap)
        if val:
            obj_info.synonym = val
            break

    comment_xpaths = [
        ".//md:Properties/md:Comment",
        ".//md:Comment",
    ]
    for xp in comment_xpaths:
        val = get_xml_text(root, xp, nsmap=nsmap)
        if val:
            obj_info.comment = val
            break
