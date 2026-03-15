"""Scan 1C XML dumps and build a metadata object index."""

from __future__ import annotations

import os
import re
from typing import Dict, Iterable, List, Optional, Tuple

from models import ObjectInfo
from xml_helpers import TYPE_TO_FOLDER, get_full_object_key, parse_xml_file


def resolve_config_root(config_path: str) -> Tuple[str, Optional[str]]:
    """Resolve config root directory and Configuration.xml path."""

    path = os.path.abspath(config_path)
    if os.path.isfile(path):
        return os.path.dirname(path), path

    config_xml = os.path.join(path, "Configuration.xml")
    if os.path.isfile(config_xml):
        return path, config_xml
    return path, None


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _discover_object_xml(root_dir: str, obj_type: str, name: str) -> Optional[str]:
    folder = TYPE_TO_FOLDER.get(obj_type)
    if not folder:
        return None
    folder_path = os.path.join(root_dir, folder)
    candidates = [
        os.path.join(folder_path, name, f"{name}.xml"),
        os.path.join(folder_path, f"{name}.xml"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    if os.path.isdir(folder_path):
        for current_root, _, files in os.walk(folder_path):
            for file_name in files:
                if file_name.lower() != f"{name.lower()}.xml":
                    continue
                return os.path.join(current_root, file_name)
    return None


def _object_dir_from_xml(xml_path: Optional[str]) -> str:
    if not xml_path:
        return ""
    base_name = os.path.splitext(os.path.basename(xml_path))[0]
    parent = os.path.dirname(xml_path)
    if os.path.basename(parent) == base_name:
        return parent
    return parent


def _list_child_names(path: str, subdir: str) -> List[str]:
    directory = os.path.join(path, subdir)
    if not os.path.isdir(directory):
        return []
    result = []
    for name in sorted(os.listdir(directory)):
        full_path = os.path.join(directory, name)
        if os.path.isdir(full_path):
            result.append(name)
        elif os.path.isfile(full_path):
            result.append(os.path.splitext(name)[0])
    return result


def _index_object(root_dir: str, obj_type: str, name: str) -> ObjectInfo:
    xml_path = _discover_object_xml(root_dir, obj_type, name)
    object_dir = _object_dir_from_xml(xml_path)
    obj = ObjectInfo(name=name, obj_type=obj_type, path=object_dir)
    if xml_path:
        obj.properties["xml_path"] = xml_path
    if object_dir:
        obj.forms = _list_child_names(object_dir, "Forms")
        obj.templates = _list_child_names(object_dir, "Templates")
        obj.commands = _list_child_names(object_dir, "Commands")
    return obj


def _extract_objects_from_configuration(config_xml_path: str, root_dir: str) -> Dict[str, ObjectInfo]:
    objects: Dict[str, ObjectInfo] = {}
    root = parse_xml_file(config_xml_path)
    if root is None:
        return objects

    known_types = set(TYPE_TO_FOLDER)
    known_pattern = re.compile(rf"^({'|'.join(sorted(known_types, key=len, reverse=True))})\.(.+)$")

    for element in root.iter():
        tag_name = _local_name(element.tag)
        text = (element.text or "").strip()

        if tag_name in known_types and text:
            obj = _index_object(root_dir, tag_name, text)
            objects[obj.key] = obj

        if text:
            match = known_pattern.match(text)
            if match:
                obj_type, name = match.groups()
                obj = _index_object(root_dir, obj_type, name)
                objects[obj.key] = obj
                continue

            if "/" in text and text.endswith(".xml"):
                name = os.path.splitext(os.path.basename(text))[0]
                folder_name = text.split("/", 1)[0]
                for obj_type, folder in TYPE_TO_FOLDER.items():
                    if folder == folder_name:
                        obj = _index_object(root_dir, obj_type, name)
                        objects[obj.key] = obj
                        break

    return objects


def _scan_folders(root_dir: str) -> Dict[str, ObjectInfo]:
    objects: Dict[str, ObjectInfo] = {}
    for obj_type, folder in TYPE_TO_FOLDER.items():
        folder_path = os.path.join(root_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        for entry in sorted(os.listdir(folder_path)):
            full_path = os.path.join(folder_path, entry)
            if os.path.isdir(full_path):
                xml_path = os.path.join(full_path, f"{entry}.xml")
                if os.path.isfile(xml_path):
                    obj = _index_object(root_dir, obj_type, entry)
                    objects[obj.key] = obj
            elif entry.lower().endswith(".xml"):
                name = os.path.splitext(entry)[0]
                obj = _index_object(root_dir, obj_type, name)
                objects[obj.key] = obj
    return objects


def scan_configuration(config_path: str) -> Tuple[str, Optional[str], Dict[str, ObjectInfo]]:
    """Scan a configuration dump and return indexed objects."""

    root_dir, config_xml = resolve_config_root(config_path)
    objects: Dict[str, ObjectInfo] = {}

    if config_xml:
        objects.update(_extract_objects_from_configuration(config_xml, root_dir))
    objects.update(_scan_folders(root_dir))

    return root_dir, config_xml, objects


def get_objects_by_type(objects: Dict[str, ObjectInfo], *obj_types: str) -> List[ObjectInfo]:
    wanted = set(obj_types)
    return [obj for obj in objects.values() if obj.obj_type in wanted]


def iter_object_xml_paths(objects: Iterable[ObjectInfo]) -> Iterable[str]:
    for obj in objects:
        xml_path = obj.properties.get("xml_path", "")
        if xml_path:
            yield xml_path
