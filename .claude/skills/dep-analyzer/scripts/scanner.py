"""Сканирование XML-выгрузки конфигурации 1С и базовый индекс объектов."""

from __future__ import annotations

import os
from typing import Dict, Iterable, List, Optional, Tuple

from models import ObjectInfo
from xml_helpers import (
    TYPE_TO_FOLDER,
    get_xml_elements,
    get_xml_text,
    local_name,
    parse_xml_file,
)


def discover_configuration_root(config_path: str) -> str:
    """Нормализовать путь к корню выгрузки конфигурации."""

    absolute = os.path.abspath(config_path)
    if os.path.isfile(absolute):
        if os.path.basename(absolute).lower() == "configuration.xml":
            return os.path.dirname(absolute)
        return os.path.dirname(absolute)
    return absolute


def resolve_object_main_xml(object_path: str) -> Optional[str]:
    """Найти основной XML-файл объекта по каталогу или файлу."""

    absolute = os.path.abspath(object_path)
    if os.path.isfile(absolute) and absolute.lower().endswith(".xml"):
        return absolute
    if not os.path.isdir(absolute):
        return None

    base_name = os.path.basename(absolute)
    candidates = [
        os.path.join(absolute, f"{base_name}.xml"),
        os.path.join(os.path.dirname(absolute), f"{base_name}.xml"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate

    xml_files = sorted(
        file_name
        for file_name in os.listdir(absolute)
        if file_name.lower().endswith(".xml")
    )
    if xml_files:
        return os.path.join(absolute, xml_files[0])
    return None


def get_type_node(xml_root) -> Tuple[str, Optional[object]]:
    """Определить тип объекта метаданных и корневой узел типа."""

    if xml_root is None:
        return "", None

    md_root = xml_root
    if local_name(xml_root) != "MetaDataObject":
        candidates = get_xml_elements(xml_root, "/md:MetaDataObject")
        md_root = candidates[0] if candidates else None
    if md_root is None:
        return "", None

    for child in md_root:
        if not isinstance(getattr(child, "tag", None), str):
            continue
        if local_name(child):
            return local_name(child), child
    return "", None


def parse_multilang_text(node) -> str:
    """Прочитать мультиязычный текст, если он задан в v8:item/v8:content."""

    if node is None:
        return ""
    ru_content = get_xml_text(node, ".//v8:item[v8:lang='ru']/v8:content")
    if ru_content:
        return ru_content
    any_content = get_xml_text(node, ".//v8:item/v8:content")
    if any_content:
        return any_content
    return (getattr(node, "text", "") or "").strip()


def extract_name(node, fallback: str = "") -> str:
    """Извлечь имя элемента по частым XPath-вариантам."""

    paths = [
        "./md:Properties/md:Name",
        "./md:Name",
        ".//*[local-name()='Properties']/*[local-name()='Name']",
        ".//*[local-name()='Name']",
    ]
    for xpath in paths:
        value = get_xml_text(node, xpath)
        if value:
            return value
    return fallback


def collect_named_children(node, xpath: str) -> List[str]:
    result: List[str] = []
    for child in get_xml_elements(node, xpath):
        name = extract_name(child)
        if name:
            result.append(name)
    return result


def discover_bsl_files(object_path: str, config_root: str) -> List[str]:
    """Собрать все BSL-файлы внутри объекта."""

    if not object_path or not os.path.isdir(object_path):
        return []
    result: List[str] = []
    for root, _dirs, files in os.walk(object_path):
        for file_name in files:
            if not file_name.lower().endswith(".bsl"):
                continue
            absolute = os.path.join(root, file_name)
            result.append(os.path.relpath(absolute, config_root))
    return sorted(set(result))


def enumerate_object_locations(config_root: str, folder_name: str) -> Iterable[str]:
    """Перечислить каталоги/файлы объектов в каталоге типа."""

    folder_path = os.path.join(config_root, folder_name)
    if not os.path.isdir(folder_path):
        return []

    result: List[str] = []
    for entry in sorted(os.listdir(folder_path)):
        if entry.startswith("."):
            continue
        absolute = os.path.join(folder_path, entry)
        if os.path.isdir(absolute):
            result.append(absolute)
        elif entry.lower().endswith(".xml"):
            result.append(absolute)
    return result


def build_object_info_from_path(obj_type: str, location: str, config_root: str) -> Optional[ObjectInfo]:
    """Создать ObjectInfo с базовыми свойствами из XML-объекта."""

    xml_path = resolve_object_main_xml(location)
    if not xml_path:
        return None

    xml_root = parse_xml_file(xml_path)
    detected_type, type_node = get_type_node(xml_root)
    if not type_node:
        return None

    object_name = extract_name(type_node, fallback=os.path.splitext(os.path.basename(xml_path))[0])
    object_dir = location if os.path.isdir(location) else os.path.dirname(xml_path)
    info = ObjectInfo(
        name=object_name,
        obj_type=detected_type or obj_type,
        path=os.path.abspath(object_dir),
    )
    info.synonym = parse_multilang_text(get_xml_elements(type_node, "./md:Properties/md:Synonym")[0]) if get_xml_elements(type_node, "./md:Properties/md:Synonym") else ""
    info.comment = get_xml_text(type_node, "./md:Properties/md:Comment")

    properties_to_capture = [
        "UseStandardCommands",
        "DefaultObjectForm",
        "DefaultListForm",
        "DefaultChoiceForm",
        "Posting",
        "RegisterRecordsWritingOnPost",
        "HierarchyType",
        "Owners",
        "UsePurposes",
        "Global",
        "ClientManagedApplication",
        "Server",
        "ExternalConnection",
        "SafeMode",
        "RestartOnFailure",
        "Module",
        "Handler",
        "Event",
        "MainPresentation",
    ]
    for property_name in properties_to_capture:
        value = get_xml_text(
            type_node,
            f".//*[local-name()='Properties']/*[local-name()='{property_name}']",
        )
        if value:
            info.properties[property_name] = value

    info.forms = collect_named_children(type_node, ".//*[local-name()='Forms']/*")
    info.templates = collect_named_children(type_node, ".//*[local-name()='Templates']/*")
    info.commands = collect_named_children(type_node, ".//*[local-name()='Commands']/*")

    if info.obj_type == "CommonModule":
        info.is_global = get_xml_text(type_node, ".//*[local-name()='Global']").lower() == "true"
        info.is_server = get_xml_text(type_node, ".//*[local-name()='Server']").lower() == "true"
        info.is_client = get_xml_text(type_node, ".//*[local-name()='ClientManagedApplication']").lower() == "true"
        info.is_external = get_xml_text(type_node, ".//*[local-name()='ExternalConnection']").lower() == "true"

    if info.obj_type == "EventSubscription":
        info.handler = get_xml_text(type_node, ".//*[local-name()='Handler']")
        info.event = get_xml_text(type_node, ".//*[local-name()='Event']")
        source_items = get_xml_elements(type_node, ".//*[local-name()='Source']//*[local-name()='Item']")
        if not source_items:
            source_items = get_xml_elements(type_node, ".//*[local-name()='Source']")
        info.source_types = [
            (getattr(item, "text", "") or "").strip()
            for item in source_items
            if (getattr(item, "text", "") or "").strip()
        ]

    modules = discover_bsl_files(info.path, config_root)
    if modules:
        info.properties["module_paths"] = ",".join(modules)
        info.properties["primary_module_path"] = modules[0]

    return info


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Собрать индекс объектов конфигурации."""

    config_root = discover_configuration_root(config_path)
    objects: Dict[str, ObjectInfo] = {}

    for obj_type, folder_name in TYPE_TO_FOLDER.items():
        for location in enumerate_object_locations(config_root, folder_name):
            info = build_object_info_from_path(obj_type, location, config_root)
            if not info:
                continue
            objects[f"{info.obj_type}.{info.name}"] = info

    return objects
