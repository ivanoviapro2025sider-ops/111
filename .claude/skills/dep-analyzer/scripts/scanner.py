"""Сканирование Configuration.xml и построение индекса объектов метаданных."""

import os
from typing import Dict, List, Optional

from models import ObjectInfo, DependencyGraph
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    NSMAP, TYPE_TO_FOLDER, FOLDER_TO_TYPE, get_full_object_key,
)

_CHILD_OBJECTS_TAG = "ChildObjects"

_METADATA_TYPES_XML_TAGS = {
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


def find_configuration_xml(config_path: str) -> Optional[str]:
    """Locate Configuration.xml within the config path."""
    direct = os.path.join(config_path, "Configuration.xml")
    if os.path.isfile(direct):
        return direct

    conf_dir = os.path.join(config_path, "Configuration")
    if os.path.isdir(conf_dir):
        candidate = os.path.join(conf_dir, "Configuration.xml")
        if os.path.isfile(candidate):
            return candidate

    for root, dirs, files in os.walk(config_path):
        if "Configuration.xml" in files:
            return os.path.join(root, "Configuration.xml")
        if root.count(os.sep) - config_path.count(os.sep) > 3:
            break

    return None


def _resolve_object_path(config_root: str, obj_type: str, name: str) -> str:
    """Determine the filesystem path to the object directory."""
    folder = TYPE_TO_FOLDER.get(obj_type, obj_type + "s")

    obj_dir = os.path.join(config_root, folder, name)
    if os.path.isdir(obj_dir):
        return obj_dir

    parent_dir = os.path.dirname(config_root)
    obj_dir_alt = os.path.join(parent_dir, folder, name)
    if os.path.isdir(obj_dir_alt):
        return obj_dir_alt

    return os.path.join(config_root, folder, name)


def scan_configuration(config_path: str) -> DependencyGraph:
    """Scan Configuration.xml and build the initial object index.

    Returns a DependencyGraph populated with ObjectInfo entries (without
    parsed attributes/references — those are filled by individual parsers).
    """
    graph = DependencyGraph()

    config_xml_path = find_configuration_xml(config_path)
    if not config_xml_path:
        print(f"[ERROR] Configuration.xml not found in {config_path}")
        return graph

    config_root_dir = os.path.dirname(config_xml_path)
    root = parse_xml_file(config_xml_path)
    if root is None:
        print(f"[ERROR] Failed to parse {config_xml_path}")
        return graph

    _scan_child_objects(root, config_root_dir, graph)

    _scan_by_folder_structure(config_path, graph)

    return graph


def _scan_child_objects(root, config_root_dir: str, graph: DependencyGraph):
    """Extract object names from <ChildObjects> in Configuration.xml."""
    ns_md = NSMAP.get("md", "")

    for child_objects in root.iter(f"{{{ns_md}}}{_CHILD_OBJECTS_TAG}"):
        for elem in child_objects:
            tag = _strip_ns(elem.tag)
            if tag in _METADATA_TYPES_XML_TAGS and elem.text:
                obj_name = elem.text.strip()
                obj_type = _METADATA_TYPES_XML_TAGS[tag]
                if not graph.get_object(obj_type, obj_name):
                    obj_path = _resolve_object_path(config_root_dir, obj_type, obj_name)
                    obj = ObjectInfo(
                        name=obj_name,
                        obj_type=obj_type,
                        path=obj_path,
                    )
                    graph.add_object(obj)

    if not graph.objects:
        for tag_name, obj_type in _METADATA_TYPES_XML_TAGS.items():
            for elem in root.iter():
                local = _strip_ns(elem.tag)
                if local == tag_name and elem.text and elem.text.strip():
                    obj_name = elem.text.strip()
                    if not graph.get_object(obj_type, obj_name):
                        obj_path = _resolve_object_path(config_root_dir, obj_type, obj_name)
                        obj = ObjectInfo(name=obj_name, obj_type=obj_type, path=obj_path)
                        graph.add_object(obj)


def _scan_by_folder_structure(config_path: str, graph: DependencyGraph):
    """Fallback: discover objects by scanning folder structure.
    Looks for <TypeFolder>/<ObjectName>/<ObjectName>.xml pattern.
    """
    for folder_name, obj_type in FOLDER_TO_TYPE.items():
        folder_path = os.path.join(config_path, folder_name)
        if not os.path.isdir(folder_path):
            parent_dir = os.path.dirname(config_path)
            folder_path = os.path.join(parent_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue

        try:
            entries = os.listdir(folder_path)
        except OSError:
            continue

        for entry in entries:
            entry_path = os.path.join(folder_path, entry)
            if not os.path.isdir(entry_path):
                continue

            if graph.get_object(obj_type, entry):
                existing = graph.get_object(obj_type, entry)
                if existing and not existing.path:
                    existing.path = entry_path
                continue

            obj = ObjectInfo(name=entry, obj_type=obj_type, path=entry_path)
            graph.add_object(obj)


def get_object_xml_path(obj_info: ObjectInfo) -> Optional[str]:
    """Get the path to the main XML file of an object."""
    if not obj_info.path:
        return None

    direct = os.path.join(obj_info.path, f"{obj_info.name}.xml")
    if os.path.isfile(direct):
        return direct

    ext_xml = os.path.join(obj_info.path, "Ext", f"{obj_info.name}.xml")
    if os.path.isfile(ext_xml):
        return ext_xml

    ext_obj_xml = os.path.join(obj_info.path, "Ext", "ObjectModule.xml")
    if os.path.isfile(ext_obj_xml):
        return ext_obj_xml

    for fname in os.listdir(obj_info.path) if os.path.isdir(obj_info.path) else []:
        if fname.endswith(".xml"):
            return os.path.join(obj_info.path, fname)

    return None


def get_bsl_module_paths(obj_info: ObjectInfo) -> List[str]:
    """Find all BSL module files for an object."""
    result = []
    if not obj_info.path or not os.path.isdir(obj_info.path):
        return result

    for root, dirs, files in os.walk(obj_info.path):
        for f in files:
            if f.endswith(".bsl"):
                result.append(os.path.join(root, f))

    return result


def _strip_ns(tag: str) -> str:
    """Remove XML namespace prefix from tag."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
