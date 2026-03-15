"""Configuration scanner: loads metadata objects index from 1C dump."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, Optional

from models import ObjectInfo
from xml_helpers import TYPE_TO_FOLDER, get_full_object_key, get_xml_text, parse_xml_file


class ConfigurationScanner:
    """Scans configuration dump and builds a flat object index."""

    def __init__(self, config_path: str) -> None:
        self.config_root = self._resolve_config_root(Path(config_path))
        self.configuration_xml = self.config_root / "Configuration.xml"

    @staticmethod
    def _resolve_config_root(path: Path) -> Path:
        if path.is_file():
            if path.name.lower() == "configuration.xml":
                return path.parent
            return path.parent
        return path

    def scan(self) -> Dict[str, ObjectInfo]:
        objects: Dict[str, ObjectInfo] = {}
        self._scan_from_filesystem(objects)
        self._scan_from_configuration_xml(objects)
        return objects

    def _scan_from_filesystem(self, objects: Dict[str, ObjectInfo]) -> None:
        for obj_type, folder_name in TYPE_TO_FOLDER.items():
            folder_path = self.config_root / folder_name
            if not folder_path.exists() or not folder_path.is_dir():
                continue

            for entry in sorted(folder_path.iterdir()):
                if entry.name.startswith("."):
                    continue
                obj_name = entry.stem if entry.is_file() else entry.name
                key = get_full_object_key(obj_type, obj_name)
                if key not in objects:
                    objects[key] = ObjectInfo(name=obj_name, obj_type=obj_type, path=str(entry))

                self._enrich_object_structure(objects[key], entry)

    def _scan_from_configuration_xml(self, objects: Dict[str, ObjectInfo]) -> None:
        root = parse_xml_file(str(self.configuration_xml))
        if root is None:
            return

        for obj_type in TYPE_TO_FOLDER:
            tag = obj_type
            candidates = root.xpath(f".//*[local-name()='{tag}']")
            for node in candidates:
                obj_name = self._extract_name_from_node(node)
                if not obj_name:
                    continue
                key = get_full_object_key(obj_type, obj_name)
                if key not in objects:
                    objects[key] = ObjectInfo(name=obj_name, obj_type=obj_type, path="")

                synonym = get_xml_text(node, "./*[local-name()='Synonym']")
                if synonym and not objects[key].synonym:
                    objects[key].synonym = synonym

    @staticmethod
    def _extract_name_from_node(node) -> str:
        for name_xpath in (
            "./*[local-name()='Name']/text()",
            "./*[local-name()='Properties']/*[local-name()='Name']/text()",
            "./*[local-name()='Value']/text()",
            "./text()",
        ):
            found = node.xpath(name_xpath)
            if found:
                value = str(found[0]).strip()
                if value:
                    return value
        return ""

    @staticmethod
    def _enrich_object_structure(obj_info: ObjectInfo, entry_path: Path) -> None:
        if entry_path.is_dir():
            for child in entry_path.iterdir():
                lower = child.name.lower()
                if child.is_file() and lower.endswith(".xml"):
                    if "form" in lower:
                        obj_info.forms.append(child.stem)
                    elif "template" in lower:
                        obj_info.templates.append(child.stem)
                    elif "command" in lower:
                        obj_info.commands.append(child.stem)
            obj_info.forms = sorted(set(obj_info.forms))
            obj_info.templates = sorted(set(obj_info.templates))
            obj_info.commands = sorted(set(obj_info.commands))


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Convenience function for scanner usage from orchestrator."""
    scanner = ConfigurationScanner(config_path)
    return scanner.scan()


def iter_object_xml_candidates(obj_info: ObjectInfo) -> Iterable[Path]:
    """Returns likely XML files with object metadata definition."""
    obj_path = Path(obj_info.path)
    if not obj_path.exists():
        return []
    if obj_path.is_file() and obj_path.suffix.lower() == ".xml":
        return [obj_path]
    if obj_path.is_dir():
        files = sorted(
            p
            for p in obj_path.iterdir()
            if p.is_file() and p.suffix.lower() == ".xml" and "form" not in p.name.lower()
        )
        return files
    return []
