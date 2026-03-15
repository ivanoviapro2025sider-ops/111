"""Configuration scanner for 1C metadata export."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from models import DependencyGraph, ObjectInfo
from xml_helpers import TYPE_TO_FOLDER, get_xml_elements, get_xml_text, parse_xml_file


def _iter_object_dirs(base_path: Path) -> Iterable[Tuple[str, Path]]:
    for obj_type, folder in TYPE_TO_FOLDER.items():
        folder_path = base_path / folder
        if not folder_path.is_dir():
            continue
        for child in folder_path.iterdir():
            if child.is_dir():
                yield obj_type, child


def _guess_main_xml(object_dir: Path, object_name: str) -> Optional[Path]:
    preferred = [
        object_dir / f"{object_name}.xml",
        object_dir / "Ext" / "ObjectModule.xml",
        object_dir / "Ext" / "ManagerModule.xml",
        object_dir / "Ext" / "Object.xml",
    ]
    for candidate in preferred:
        if candidate.is_file():
            return candidate

    xml_files = sorted(object_dir.glob("*.xml"))
    if xml_files:
        return xml_files[0]

    ext_files = sorted((object_dir / "Ext").glob("*.xml")) if (object_dir / "Ext").is_dir() else []
    if ext_files:
        return ext_files[0]
    return None


def _collect_list(root, xpath: str) -> List[str]:
    result: List[str] = []
    for item in get_xml_elements(root, xpath):
        value = ""
        if hasattr(item, "text"):
            value = (item.text or "").strip()
        else:
            value = str(item).strip()
        if value and value not in result:
            result.append(value)
    return result


def _fill_basic_fields(obj: ObjectInfo, main_xml_path: Optional[Path]) -> None:
    if not main_xml_path:
        return
    root = parse_xml_file(str(main_xml_path))
    if root is None:
        return

    obj.synonym = (
        get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='Item']")
        or get_xml_text(root, ".//*[local-name()='Synonym']")
        or obj.synonym
    )
    obj.comment = get_xml_text(root, ".//*[local-name()='Comment']")

    forms = _collect_list(root, ".//*[local-name()='Form']/*[local-name()='Name']")
    forms += _collect_list(root, ".//*[local-name()='Forms']/*[local-name()='Form']")
    obj.forms = sorted(set(forms))

    templates = _collect_list(root, ".//*[local-name()='Template']/*[local-name()='Name']")
    templates += _collect_list(root, ".//*[local-name()='Templates']/*[local-name()='Template']")
    obj.templates = sorted(set(templates))

    commands = _collect_list(root, ".//*[local-name()='Command']/*[local-name()='Name']")
    commands += _collect_list(root, ".//*[local-name()='Commands']/*[local-name()='Command']")
    obj.commands = sorted(set(commands))


def scan_configuration(config_path: str) -> DependencyGraph:
    """Build initial object index by scanning exported configuration folders."""
    base_path = Path(config_path).resolve()
    graph = DependencyGraph()

    for obj_type, object_dir in _iter_object_dirs(base_path):
        obj_name = object_dir.name
        obj = ObjectInfo(name=obj_name, obj_type=obj_type, path=str(object_dir))
        main_xml = _guess_main_xml(object_dir, obj_name)
        _fill_basic_fields(obj, main_xml)
        graph.add_object(obj)

    return graph


def build_object_xml_index(graph: DependencyGraph) -> Dict[str, str]:
    """Map metadata key -> best matching xml path."""
    index: Dict[str, str] = {}
    for key, obj in graph.objects.items():
        object_dir = Path(obj.path)
        main_xml = _guess_main_xml(object_dir, obj.name)
        if main_xml:
            index[key] = str(main_xml)
    return index


def read_configuration_root(config_path: str):
    """Parse top-level Configuration.xml if it exists."""
    cfg_xml = Path(config_path) / "Configuration.xml"
    if not cfg_xml.is_file():
        return None
    return parse_xml_file(str(cfg_xml))

