"""Парсер справочников (Catalog)."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


REFERENCE_TYPES = {
    "Catalog",
    "Document",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
    "BusinessProcess",
    "Task",
    "ExchangePlan",
    "InformationRegister",
    "AccumulationRegister",
}


def _guess_main_xml(obj: ObjectInfo) -> Optional[Path]:
    """Определить основной XML-файл справочника."""
    object_dir = Path(obj.path)
    candidates = [object_dir / f"{obj.name}.xml"]
    candidates.extend(sorted(object_dir.glob("*.xml")))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _extract_types(type_parent) -> List[TypeRef]:
    """Извлечь типы из контейнера TypeDescription/Type."""
    type_nodes = get_xml_elements(type_parent, ".//*[local-name()='Type']")
    if not type_nodes:
        type_nodes = [type_parent]

    refs: List[TypeRef] = []
    seen: set = set()
    for node in type_nodes:
        for info in parse_types_from_element(node):
            key = (info["type"], info["name"], info["full_type"])
            if key in seen:
                continue
            seen.add(key)
            refs.append(TypeRef(obj_type=info["type"], name=info["name"], full_type=info["full_type"]))
    return refs


def _build_attribute(attr_node, tabular_section: str = "") -> AttributeInfo:
    """Построить AttributeInfo из XML-узла реквизита."""
    attr_name = get_xml_text(attr_node, ".//*[local-name()='Name']")
    type_parent = get_xml_elements(attr_node, ".//*[local-name()='TypeDescription']")
    type_parent = type_parent[0] if type_parent else attr_node
    types = _extract_types(type_parent)
    return AttributeInfo(name=attr_name, types=types, tabular_section=tabular_section)


def _append_reference(obj: ObjectInfo, attr: AttributeInfo) -> None:
    """Добавить ReferenceInfo для каждого ссылочного типа реквизита."""
    for type_ref in attr.types:
        if type_ref.obj_type not in REFERENCE_TYPES:
            continue
        ref_kind = "attribute"
        obj.references.append(
            ReferenceInfo(
                source_attribute=attr.name,
                target_type=type_ref.obj_type,
                target_name=type_ref.name,
                tabular_section=attr.tabular_section,
                ref_kind=ref_kind,
            )
        )


def parse_catalog_object(obj: ObjectInfo) -> None:
    """Парсинг одного справочника: реквизиты, ТЧ, владелец, иерархия."""
    xml_path = _guess_main_xml(obj)
    if xml_path is None:
        return

    root = parse_xml_file(str(xml_path))
    if root is None:
        return

    obj.attributes = []
    obj.tabular_sections = []

    # Реквизиты
    for attr_node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
        attr = _build_attribute(attr_node)
        if attr.name:
            obj.attributes.append(attr)
            _append_reference(obj, attr)

    # Табличные части
    for ts_node in get_xml_elements(root, ".//*[local-name()='TabularSections']/*[local-name()='TabularSection']"):
        ts_name = get_xml_text(ts_node, ".//*[local-name()='Name']")
        ts_info = TabularSectionInfo(name=ts_name)
        for attr_node in get_xml_elements(ts_node, ".//*[local-name()='Attribute']"):
            attr = _build_attribute(attr_node, tabular_section=ts_name)
            if attr.name:
                ts_info.attributes.append(attr)
                _append_reference(obj, attr)
        obj.tabular_sections.append(ts_info)

    # Владелец
    owner_name = get_xml_text(root, ".//*[local-name()='Owners']//*[local-name()='Catalog']")
    if owner_name:
        obj.references.append(
            ReferenceInfo(
                source_attribute="Owner",
                target_type="Catalog",
                target_name=owner_name,
                ref_kind="owner",
            )
        )

    # Иерархия
    hierarchy_flag = get_xml_text(root, ".//*[local-name()='Hierarchical']")
    if hierarchy_flag.lower() == "true":
        obj.references.append(
            ReferenceInfo(
                source_attribute="Parent",
                target_type="Catalog",
                target_name=obj.name,
                ref_kind="hierarchy",
            )
        )


def parse_catalogs(graph) -> None:
    """Парсинг всех справочников в графе."""
    for obj in graph.objects.values():
        if obj.obj_type == "Catalog":
            parse_catalog_object(obj)
