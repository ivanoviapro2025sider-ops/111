"""Configuration scanner and object indexer."""

from __future__ import annotations

import os
from typing import Dict, Iterable, Tuple

from models import ObjectInfo
from xml_helpers import TYPE_TO_FOLDER, get_full_object_key, parse_xml_file


def _detect_config_root(config_path: str) -> str:
    abs_path = os.path.abspath(config_path)
    if os.path.isfile(abs_path):
        return os.path.dirname(abs_path)
    return abs_path


def _discover_objects_in_folder(folder_path: str) -> Iterable[Tuple[str, str]]:
    """Yield pairs: (object_name, object_path)."""
    if not os.path.isdir(folder_path):
        return

    for entry in sorted(os.listdir(folder_path)):
        full_path = os.path.join(folder_path, entry)
        if os.path.isdir(full_path):
            yield entry, full_path
            continue
        if entry.lower().endswith(".xml"):
            object_name = os.path.splitext(entry)[0]
            yield object_name, full_path


def _extract_names_from_configuration_xml(config_root: str) -> Dict[str, set]:
    """Try to read object names from Configuration.xml for additional coverage."""
    names: Dict[str, set] = {obj_type: set() for obj_type in TYPE_TO_FOLDER}
    configuration_xml = os.path.join(config_root, "Configuration.xml")
    root = parse_xml_file(configuration_xml)
    if root is None:
        return names

    for obj_type in TYPE_TO_FOLDER:
        # Works for both namespaced and local-name exports.
        xpath = (
            f".//*[local-name()='{obj_type}']/*[local-name()='Name']/text() | "
            f".//*[local-name()='{obj_type}' and @name]/@name"
        )
        try:
            for value in root.xpath(xpath):
                text = str(value).strip()
                if text:
                    names[obj_type].add(text)
        except Exception:
            continue
    return names


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Scan exported 1C configuration and build a metadata object index."""
    config_root = _detect_config_root(config_path)
    objects: Dict[str, ObjectInfo] = {}

    names_from_cfg = _extract_names_from_configuration_xml(config_root)
    for obj_type, folder in TYPE_TO_FOLDER.items():
        folder_path = os.path.join(config_root, folder)
        seen_names = set()
        for obj_name, obj_path in _discover_objects_in_folder(folder_path):
            key = get_full_object_key(obj_type, obj_name)
            objects[key] = ObjectInfo(name=obj_name, obj_type=obj_type, path=os.path.abspath(obj_path))
            seen_names.add(obj_name)

        # Ensure objects listed in Configuration.xml are still indexed (even if path missing).
        for obj_name in sorted(names_from_cfg.get(obj_type, set()) - seen_names):
            key = get_full_object_key(obj_type, obj_name)
            objects[key] = ObjectInfo(name=obj_name, obj_type=obj_type, path=folder_path)

    return objects
