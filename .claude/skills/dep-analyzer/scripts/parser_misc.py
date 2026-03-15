"""Парсер прочих объектов метаданных: подписки, общие модули, перечисления, обработки, отчёты и т.д."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from models import ObjectInfo
from xml_helpers import get_xml_elements, get_xml_text, parse_xml_file


def _guess_main_xml(obj: ObjectInfo) -> Optional[Path]:
    """Определить основной XML-файл объекта."""
    object_dir = Path(obj.path)
    candidates = [object_dir / f"{obj.name}.xml"]
    candidates.extend(sorted(object_dir.glob("*.xml")))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _parse_common_module(obj: ObjectInfo, root) -> None:
    """Парсинг общего модуля: флаги Global, Server, Client, ExternalConnection."""
    obj.is_global = get_xml_text(root, ".//*[local-name()='Global']").lower() == "true"
    obj.is_server = get_xml_text(root, ".//*[local-name()='Server']").lower() == "true"
    obj.is_client = get_xml_text(root, ".//*[local-name()='Client']").lower() == "true"
    obj.is_external = get_xml_text(root, ".//*[local-name()='ExternalConnection']").lower() == "true"


def _parse_event_subscription(obj: ObjectInfo, root) -> None:
    """Парсинг подписки на событие: Event, Handler, Source types."""
    obj.event = get_xml_text(root, ".//*[local-name()='Event']")
    obj.handler = get_xml_text(root, ".//*[local-name()='Handler']")
    obj.source_types = []
    for source in get_xml_elements(root, ".//*[local-name()='Source']//*[local-name()='Type']"):
        value = (source.text or "").strip()
        if value and value not in obj.source_types:
            obj.source_types.append(value)


def _parse_simple_collections(obj: ObjectInfo, root) -> None:
    """Парсинг коллекций форм и макетов."""
    for form in get_xml_elements(root, ".//*[local-name()='Forms']/*[local-name()='Form']"):
        value = (form.text or "").strip()
        if value and value not in obj.forms:
            obj.forms.append(value)
    for template in get_xml_elements(root, ".//*[local-name()='Templates']/*[local-name()='Template']"):
        value = (template.text or "").strip()
        if value and value not in obj.templates:
            obj.templates.append(value)


def parse_misc_objects(graph) -> None:
    """Парсинг всех прочих объектов: общие модули, подписки, перечисления и т.д."""
    for obj in graph.objects.values():
        xml_path = _guess_main_xml(obj)
        if xml_path is None:
            continue
        root = parse_xml_file(str(xml_path))
        if root is None:
            continue

        _parse_simple_collections(obj, root)

        if obj.obj_type == "CommonModule":
            _parse_common_module(obj, root)
        elif obj.obj_type == "EventSubscription":
            _parse_event_subscription(obj, root)
