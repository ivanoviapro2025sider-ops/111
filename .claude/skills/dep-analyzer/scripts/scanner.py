"""Configuration scanner: discovers metadata XML files and builds object index."""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

from models import ObjectInfo, RoleInfo
from parser_catalog import parse_catalog_files
from parser_document import parse_document_files
from parser_misc import parse_misc_files
from parser_register import parse_register_files
from parser_role import parse_role_files
from xml_helpers import TYPE_TO_FOLDER, get_type_folder, parse_xml_file


OBJECT_TYPES_MISC = [
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "Report",
    "DataProcessor",
    "CommonModule",
    "EventSubscription",
    "Constant",
    "DocumentJournal",
    "ScheduledJob",
    "DefinedType",
    "HTTPService",
    "WebService",
]

REGISTER_TYPES = [
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
]

_AUX_XML_NAMES = {
    "form.xml",
    "command.xml",
    "template.xml",
    "help.xml",
    "description.xml",
    "module.xml",
}


def parse_configuration_xml(config_path: str):
    """Parse root Configuration.xml if present."""
    cfg_xml = os.path.join(config_path, "Configuration.xml")
    return parse_xml_file(cfg_xml)


def discover_object_xml_files(config_path: str, obj_type: str) -> List[str]:
    """Discover object XML files for specific metadata type folder."""
    folder = get_type_folder(obj_type)
    folder_path = os.path.join(config_path, folder)
    if not os.path.isdir(folder_path):
        return []

    result: List[str] = []
    for root, _, files in os.walk(folder_path):
        for filename in files:
            if not filename.lower().endswith(".xml"):
                continue
            if filename.lower() in _AUX_XML_NAMES:
                continue
            if filename.lower() == "rights.xml" and obj_type != "Role":
                continue

            full_path = os.path.join(root, filename)
            rel = os.path.relpath(full_path, folder_path)
            rel_parts = rel.split(os.sep)

            # Typical 1C export layouts:
            # - Catalogs/Item.xml
            # - Catalogs/Item/Object.xml
            if filename.lower() == "object.xml" or len(rel_parts) <= 2:
                result.append(full_path)

    return sorted(set(result))


def build_file_index(config_path: str) -> Dict[str, List[str]]:
    """Build discovered XML index by object type."""
    index: Dict[str, List[str]] = {}
    for obj_type in TYPE_TO_FOLDER:
        files = discover_object_xml_files(config_path, obj_type)
        if files:
            index[obj_type] = files
    return index


def scan_configuration(config_path: str) -> Tuple[Dict[str, ObjectInfo], Dict[str, RoleInfo], Dict[str, List[str]]]:
    """Scan configuration and return (objects, roles, file_index)."""
    if not os.path.isdir(config_path):
        raise FileNotFoundError(f"Configuration path does not exist: {config_path}")

    _ = parse_configuration_xml(config_path)
    file_index = build_file_index(config_path)

    objects: Dict[str, ObjectInfo] = {}
    roles: Dict[str, RoleInfo] = {}

    def _add(parsed: List[ObjectInfo]) -> None:
        for obj in parsed:
            key = f"{obj.obj_type}.{obj.name}"
            objects[key] = obj
            if obj.obj_type == "Role" and obj.role_info is not None:
                roles[obj.role_info.name] = obj.role_info

    if "Catalog" in file_index:
        _add(parse_catalog_files(file_index["Catalog"]))
    if "Document" in file_index:
        _add(parse_document_files(file_index["Document"]))

    for register_type in REGISTER_TYPES:
        files = file_index.get(register_type, [])
        if files:
            _add(parse_register_files(files, register_type=register_type))

    role_files = file_index.get("Role", [])
    if role_files:
        _add(parse_role_files(role_files))

    for misc_type in OBJECT_TYPES_MISC:
        files = file_index.get(misc_type, [])
        if files:
            _add(parse_misc_files(files, obj_type=misc_type))

    return objects, roles, file_index
