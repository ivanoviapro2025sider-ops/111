"""Парсер регистров: сведений, накопления, бухгалтерии, расчёта."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TypeRef
from xml_helpers import get_xml_elements, get_xml_text, parse_types_from_element, parse_xml_file


REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}

REFERENCE_TYPES = {
    "Catalog",
    "Document",
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
    "Enum",
    "ChartOfCharacteristicTypes",
    "ChartOfAccounts",
    "ChartOfCalculationTypes",
}


def _guess_main_xml(obj: ObjectInfo) -> Optional[Path]:
    """Определить основной XML-файл регистра."""
    object_dir = Path(obj.path)
    candidates = [object_dir / f"{obj.name}.xml"]
    candidates.extend(sorted(object_dir.glob("*.xml")))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _extract_type_refs(type_parent) -> List[TypeRef]:
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


def _parse_dimension_or_resource(node, is_dimension: bool, is_resource: bool) -> AttributeInfo:
    """Парсинг узла измерения, ресурса или реквизита регистра."""
    name = get_xml_text(node, ".//*[local-name()='Name']")
    type_parent = get_xml_elements(node, ".//*[local-name()='TypeDescription']")
    type_parent = type_parent[0] if type_parent else node
    return AttributeInfo(
        name=name,
        types=_extract_type_refs(type_parent),
        is_dimension=is_dimension,
        is_resource=is_resource,
    )


def parse_register_object(obj: ObjectInfo) -> None:
    """Парсинг одного регистра: измерения, ресурсы, реквизиты, регистратор."""
    xml_path = _guess_main_xml(obj)
    if xml_path is None:
        return
    root = parse_xml_file(str(xml_path))
    if root is None:
        return

    obj.attributes = []

    # Измерения
    for dim in get_xml_elements(root, ".//*[local-name()='Dimensions']/*[local-name()='Dimension']"):
        attr = _parse_dimension_or_resource(dim, is_dimension=True, is_resource=False)
        if attr.name:
            obj.attributes.append(attr)

    # Ресурсы
    for res in get_xml_elements(root, ".//*[local-name()='Resources']/*[local-name()='Resource']"):
        attr = _parse_dimension_or_resource(res, is_dimension=False, is_resource=True)
        if attr.name:
            obj.attributes.append(attr)

    # Реквизиты
    for attr_node in get_xml_elements(root, ".//*[local-name()='Attributes']/*[local-name()='Attribute']"):
        attr = _parse_dimension_or_resource(attr_node, is_dimension=False, is_resource=False)
        if attr.name:
            obj.attributes.append(attr)

    # Регистратор (если есть)
    recorder_doc = get_xml_text(root, ".//*[local-name()='Recorder']//*[local-name()='Document']")
    if recorder_doc:
        obj.references.append(
            ReferenceInfo(
                source_attribute="Recorder",
                target_type="Document",
                target_name=recorder_doc,
                ref_kind="dimension",
            )
        )

    # Ссылки из измерений/ресурсов/реквизитов
    for attr in obj.attributes:
        for type_ref in attr.types:
            if type_ref.obj_type not in REFERENCE_TYPES:
                continue
            ref_kind = "dimension" if attr.is_dimension else "resource" if attr.is_resource else "attribute"
            obj.references.append(
                ReferenceInfo(
                    source_attribute=attr.name,
                    target_type=type_ref.obj_type,
                    target_name=type_ref.name,
                    ref_kind=ref_kind,
                )
            )


def parse_registers(graph) -> None:
    """Парсинг всех регистров в графе."""
    for obj in graph.objects.values():
        if obj.obj_type in REGISTER_TYPES:
            parse_register_object(obj)
