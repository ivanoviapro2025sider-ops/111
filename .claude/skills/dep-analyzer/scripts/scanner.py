"""Configuration scanner and metadata object index builder."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List, Optional

from models import ObjectInfo, ObjectType
from xml_helpers import TYPE_TO_FOLDER, get_type_folder, parse_xml_file


def _text_of_first(element, *names: str) -> str:
    for name in names:
        found = element.xpath(f"./*[local-name()='{name}']")
        if found:
            text = "".join(found[0].itertext()).strip()
            if text:
                return text
    return ""


def _bool_of_first(element, *names: str) -> bool:
    value = _text_of_first(element, *names).lower()
    return value in {"true", "1", "yes"}


def _guess_primary_xml(object_path: Path, obj_type: str, name: str) -> Optional[Path]:
    if object_path.is_file() and object_path.suffix.lower() == ".xml":
        return object_path

    candidates = list(object_path.glob("*.xml")) + list((object_path / "Ext").glob("*.xml"))
    if not candidates:
        candidates = list(object_path.rglob("*.xml"))
    if not candidates:
        return None

    priority_names = {
        f"{obj_type}.xml": 0,
        f"{name}.xml": 1,
        "Object.xml": 2,
        "Metadata.xml": 3,
    }
    ranked = sorted(
        candidates,
        key=lambda candidate: (
            priority_names.get(candidate.name, 100),
            len(candidate.relative_to(object_path).parts) if candidate.is_relative_to(object_path) else 100,
            candidate.name,
        ),
    )
    return ranked[0]


def _collect_named_children(base_path: Path, folder_name: str) -> List[str]:
    target = base_path / folder_name
    if not target.exists() or not target.is_dir():
        return []
    result: List[str] = []
    for child in sorted(target.iterdir(), key=lambda item: item.name.lower()):
        if child.name.startswith("."):
            continue
        result.append(child.stem if child.is_file() else child.name)
    return result


def _discover_folder_objects(config_root: Path, obj_type: str) -> Iterable[ObjectInfo]:
    folder_name = get_type_folder(obj_type)
    folder = config_root / folder_name
    if not folder.exists() or not folder.is_dir():
        return []

    objects: List[ObjectInfo] = []
    seen_names = set()
    for child in sorted(folder.iterdir(), key=lambda item: item.name.lower()):
        if child.name.startswith("."):
            continue

        if child.is_dir():
            name = child.name
            object_path = child
        elif child.suffix.lower() == ".xml":
            name = child.stem
            object_path = child
        else:
            continue

        if name in seen_names:
            continue
        seen_names.add(name)

        xml_path = _guess_primary_xml(object_path, obj_type, name)
        info = ObjectInfo(name=name, obj_type=obj_type, path=str(child if child.is_dir() else child.parent))
        info.properties["xml_path"] = str(xml_path) if xml_path else ""
        info.forms = _collect_named_children(Path(info.path), "Forms")
        info.templates = _collect_named_children(Path(info.path), "Templates")
        info.commands = _collect_named_children(Path(info.path), "Commands")
        objects.append(info)
    return objects


def _enrich_from_object_xml(obj_info: ObjectInfo) -> None:
    xml_path = obj_info.properties.get("xml_path", "")
    if not xml_path:
        return
    root = parse_xml_file(xml_path)
    if root is None:
        return

    obj_info.synonym = obj_info.synonym or _text_of_first(root, "Synonym", "Presentation")
    obj_info.comment = obj_info.comment or _text_of_first(root, "Comment")
    obj_info.properties.setdefault("uuid", _text_of_first(root, "UUID", "Uuid"))
    obj_info.properties.setdefault("name", _text_of_first(root, "Name") or obj_info.name)
    obj_info.properties.setdefault("root_tag", root.tag.split("}", 1)[-1])

    if obj_info.obj_type == ObjectType.COMMON_MODULE.value:
        obj_info.is_global = _bool_of_first(root, "Global")
        obj_info.is_server = _bool_of_first(root, "Server", "ServerCall")
        obj_info.is_client = _bool_of_first(root, "Client", "ClientManagedApplication")
        obj_info.is_external = _bool_of_first(root, "ExternalConnection", "External")


def _enrich_from_configuration_xml(config_root: Path, object_index: Dict[str, ObjectInfo]) -> None:
    for candidate in ("Configuration.xml", "configuration.xml"):
        config_xml = config_root / candidate
        if not config_xml.exists():
            continue
        root = parse_xml_file(str(config_xml))
        if root is None:
            continue

        for obj_type in TYPE_TO_FOLDER:
            nodes = root.xpath(f".//*[local-name()='{obj_type}']")
            for node in nodes:
                name = _text_of_first(node, "Name") or node.get("name") or node.get("Name")
                if not name:
                    continue
                key = f"{obj_type}.{name}"
                obj_info = object_index.get(key)
                if not obj_info:
                    continue
                obj_info.synonym = obj_info.synonym or _text_of_first(node, "Synonym", "Presentation")
                obj_info.comment = obj_info.comment or _text_of_first(node, "Comment")
        return


def scan_configuration(config_path: str) -> Dict[str, ObjectInfo]:
    """Scan a 1C configuration dump and build a metadata object index."""

    config_root = Path(config_path).expanduser().resolve()
    if not config_root.exists():
        raise FileNotFoundError(f"Configuration path not found: {config_root}")
    if not config_root.is_dir():
        raise NotADirectoryError(f"Configuration path is not a directory: {config_root}")

    object_index: Dict[str, ObjectInfo] = {}
    for object_type in ObjectType:
        for obj_info in _discover_folder_objects(config_root, object_type.value):
            _enrich_from_object_xml(obj_info)
            object_index[f"{obj_info.obj_type}.{obj_info.name}"] = obj_info

    _enrich_from_configuration_xml(config_root, object_index)
    return object_index
