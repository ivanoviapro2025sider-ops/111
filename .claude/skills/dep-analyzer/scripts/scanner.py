"""Сканирование Configuration.xml и построение индекса объектов метаданных."""
import os
from typing import Dict, List, Optional

from models import ObjectInfo, DependencyGraph
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    get_type_folder, get_full_object_key, _detect_nsmap,
    NSMAP, NSMAP_ALT, NS_MD, NS_V8,
)

_CHILD_TAG_TO_TYPE = {
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


def scan_configuration(config_path: str) -> DependencyGraph:
    """Сканировать конфигурацию и построить начальный индекс объектов.

    config_path: путь к корню выгрузки конфигурации (содержит Configuration.xml).
    """
    graph = DependencyGraph()
    config_xml = os.path.join(config_path, "Configuration.xml")
    root = parse_xml_file(config_xml)

    if root is None:
        print(f"[ERROR] Configuration.xml not found or invalid: {config_xml}")
        return graph

    nsmap = _detect_nsmap(root)
    _parse_configuration_xml(root, config_path, graph, nsmap)
    _scan_object_directories(config_path, graph)
    return graph


def _parse_configuration_xml(root, config_path: str, graph: DependencyGraph, nsmap: dict):
    """Извлечь список объектов из Configuration.xml через ChildObjects."""
    child_objects = get_xml_elements(root, ".//md:ChildObjects", nsmap)
    if not child_objects:
        child_objects = get_xml_elements(root, ".//ChildObjects", nsmap)
    if not child_objects:
        return

    container = child_objects[0]

    for child in container:
        tag = _local_name(child.tag)
        obj_type = _CHILD_TAG_TO_TYPE.get(tag)
        if obj_type and child.text:
            name = child.text.strip()
            if name:
                folder = get_type_folder(obj_type)
                obj_path = os.path.join(config_path, folder, name)
                obj = ObjectInfo(name=name, obj_type=obj_type, path=obj_path)
                graph.add_object(obj)


def _scan_object_directories(config_path: str, graph: DependencyGraph):
    """Дополнительное сканирование директорий — подхватить объекты,
    не перечисленные в Configuration.xml (например, при неполной выгрузке)."""
    for obj_type, folder in _CHILD_TAG_TO_TYPE.items():
        folder_name = get_type_folder(obj_type)
        folder_path = os.path.join(config_path, folder_name)
        if not os.path.isdir(folder_path):
            continue
        for entry in os.listdir(folder_path):
            entry_path = os.path.join(folder_path, entry)
            if not os.path.isdir(entry_path):
                continue
            key = get_full_object_key(obj_type, entry)
            if key not in graph.objects:
                obj = ObjectInfo(name=entry, obj_type=obj_type, path=entry_path)
                graph.add_object(obj)


def _local_name(tag: str) -> str:
    """Убрать namespace из тега: {http://...}Catalog → Catalog"""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def get_object_xml_path(obj_info: ObjectInfo) -> Optional[str]:
    """Получить путь к основному XML-файлу объекта (Ext/ObjectModule.xml и т.д.)."""
    if not obj_info.path:
        return None
    xml_name = f"{obj_info.name}.xml"
    full = os.path.join(obj_info.path, xml_name)
    if os.path.exists(full):
        return full
    alt = os.path.join(obj_info.path, "Ext", "ObjectModule.xml")
    if os.path.exists(alt):
        return alt
    return None


def get_object_bsl_paths(obj_info: ObjectInfo) -> List[str]:
    """Получить все BSL-файлы объекта."""
    bsl_files: List[str] = []
    if not obj_info.path or not os.path.isdir(obj_info.path):
        return bsl_files

    for dirpath, _, filenames in os.walk(obj_info.path):
        for fn in filenames:
            if fn.lower().endswith(".bsl"):
                bsl_files.append(os.path.join(dirpath, fn))
    return bsl_files
