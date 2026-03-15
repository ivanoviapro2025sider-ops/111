"""Configuration scanner and generic metadata extraction helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from models import AttributeInfo, ObjectInfo, ReferenceInfo, TabularSectionInfo, TypeRef
from xml_helpers import (
    TYPE_TO_FOLDER,
    get_xml_elements,
    get_xml_text,
    parse_type_value,
    parse_types_from_element,
    parse_xml_file,
)


REGISTER_TYPES = {
    "InformationRegister",
    "AccumulationRegister",
    "AccountingRegister",
    "CalculationRegister",
}

REFERENCE_TYPES = set(TYPE_TO_FOLDER)


@dataclass
class ScanContext:
    """Indexed configuration metadata."""

    root_path: str
    configuration_xml: Optional[str]
    objects: Dict[str, ObjectInfo]


def _local_name(tag: str) -> str:
    if "}" in tag:
        tag = tag.split("}", 1)[1]
    if ":" in tag:
        tag = tag.split(":", 1)[1]
    return tag


def parse_boolean(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "да"}


def resolve_config_root(config_path: str) -> str:
    path = os.path.abspath(config_path)
    if os.path.isfile(path):
        return os.path.dirname(path)
    return path


def locate_configuration_xml(config_path: str) -> Optional[str]:
    root_path = resolve_config_root(config_path)
    direct = os.path.join(root_path, "Configuration.xml")
    if os.path.exists(direct):
        return direct
    if os.path.isfile(config_path) and os.path.basename(config_path).lower() == "configuration.xml":
        return os.path.abspath(config_path)
    return None


def _infer_xml_path(root_path: str, obj_type: str, name: str, candidate: str = "") -> str:
    if candidate:
        normalized = candidate.replace("\\", os.sep).replace("/", os.sep)
        if os.path.isabs(normalized):
            return normalized
        return os.path.abspath(os.path.join(root_path, normalized))

    folder = TYPE_TO_FOLDER.get(obj_type, obj_type + "s")
    base_folder = os.path.join(root_path, folder)
    direct = os.path.join(base_folder, f"{name}.xml")
    nested = os.path.join(base_folder, name, f"{name}.xml")
    if os.path.exists(direct):
        return direct
    if os.path.exists(nested):
        return nested
    return direct


def _infer_object_dir(xml_path: str, obj_type: str, name: str) -> str:
    if not xml_path:
        return ""
    xml_dir = os.path.dirname(xml_path)
    candidate = os.path.join(xml_dir, name)
    if os.path.isdir(candidate):
        return candidate
    if os.path.basename(xml_dir) == name:
        return xml_dir
    return candidate if os.path.exists(candidate) else xml_dir


def _register_object(
    objects: Dict[str, ObjectInfo],
    root_path: str,
    obj_type: str,
    name: str,
    candidate_path: str = "",
) -> None:
    if not name:
        return
    key = f"{obj_type}.{name}"
    xml_path = _infer_xml_path(root_path, obj_type, name, candidate_path)
    obj_path = _infer_object_dir(xml_path, obj_type, name)

    if key not in objects:
        objects[key] = ObjectInfo(name=name, obj_type=obj_type, path=obj_path)
    else:
        if obj_path:
            objects[key].path = obj_path

    objects[key].properties["xml_path"] = xml_path
    objects[key].properties["root_path"] = root_path
    refresh_object_assets(objects[key], root_path)


def _scan_from_configuration_xml(root_path: str, configuration_xml: str, objects: Dict[str, ObjectInfo]) -> None:
    root = parse_xml_file(configuration_xml)
    if root is None:
        return

    for element in root.iter():
        obj_type = _local_name(str(element.tag))
        if obj_type not in TYPE_TO_FOLDER:
            continue

        name = get_xml_text(element, "./*[local-name()='Name']/text()", "")
        candidate_path = ""

        if element.text and element.text.strip():
            text_value = element.text.strip()
            if ".xml" in text_value:
                candidate_path = text_value
                if not name:
                    name = os.path.splitext(os.path.basename(text_value.replace("\\", "/")))[0]

        if not candidate_path:
            for attr_value in element.attrib.values():
                if ".xml" in str(attr_value):
                    candidate_path = str(attr_value)
                    break

        if not candidate_path:
            for child in element.iterdescendants():
                if child.text and ".xml" in child.text:
                    candidate_path = child.text.strip()
                    break
                for attr_value in child.attrib.values():
                    if ".xml" in str(attr_value):
                        candidate_path = str(attr_value)
                        break
                if candidate_path:
                    break

        if not name and candidate_path:
            name = os.path.splitext(os.path.basename(candidate_path.replace("\\", "/")))[0]

        _register_object(objects, root_path, obj_type, name, candidate_path)


def _scan_from_folders(root_path: str, objects: Dict[str, ObjectInfo]) -> None:
    for obj_type, folder in TYPE_TO_FOLDER.items():
        folder_path = os.path.join(root_path, folder)
        if not os.path.isdir(folder_path):
            continue

        for entry in sorted(os.listdir(folder_path)):
            entry_path = os.path.join(folder_path, entry)
            if entry.endswith(".xml"):
                name = os.path.splitext(entry)[0]
                _register_object(objects, root_path, obj_type, name, entry_path)
                continue

            if not os.path.isdir(entry_path):
                continue

            direct_xml = os.path.join(folder_path, f"{entry}.xml")
            nested_xml = os.path.join(entry_path, f"{entry}.xml")
            xml_path = direct_xml if os.path.exists(direct_xml) else nested_xml
            _register_object(objects, root_path, obj_type, entry, xml_path)


def scan_configuration(config_path: str) -> ScanContext:
    """Scan configuration root and build a shallow object index."""

    root_path = resolve_config_root(config_path)
    configuration_xml = locate_configuration_xml(config_path)
    objects: Dict[str, ObjectInfo] = {}

    if configuration_xml:
        _scan_from_configuration_xml(root_path, configuration_xml, objects)

    _scan_from_folders(root_path, objects)

    for obj in objects.values():
        populate_common_fields(obj)

    return ScanContext(root_path=root_path, configuration_xml=configuration_xml, objects=objects)


def resolve_object_xml_path(obj_info: ObjectInfo) -> str:
    xml_path = obj_info.properties.get("xml_path", "")
    if xml_path and os.path.exists(xml_path):
        return xml_path

    root_path = obj_info.properties.get("root_path", "")
    xml_path = _infer_xml_path(root_path, obj_info.obj_type, obj_info.name)
    obj_info.properties["xml_path"] = xml_path
    return xml_path


def load_object_xml(obj_info: ObjectInfo):
    return parse_xml_file(resolve_object_xml_path(obj_info))


def refresh_object_assets(obj_info: ObjectInfo, root_path: str = "") -> None:
    """Discover forms, templates, commands and BSL files next to the object."""

    base_path = obj_info.path or ""
    if not base_path and root_path:
        xml_path = obj_info.properties.get("xml_path", "")
        base_path = _infer_object_dir(xml_path, obj_info.obj_type, obj_info.name)
    if not base_path or not os.path.isdir(base_path):
        return

    forms: List[str] = []
    templates: List[str] = []
    commands: List[str] = []
    modules: List[str] = []

    for current_root, _, files in os.walk(base_path):
        for file_name in files:
            full_path = os.path.join(current_root, file_name)
            rel_path = os.path.relpath(full_path, obj_info.properties.get("root_path", base_path))
            lowered_dir = os.path.basename(os.path.dirname(full_path)).lower()
            lowered_file = file_name.lower()

            if lowered_file.endswith(".bsl"):
                modules.append(rel_path)
            elif lowered_dir == "forms" and lowered_file.endswith(".xml"):
                forms.append(rel_path)
            elif lowered_dir == "templates":
                templates.append(rel_path)
            elif lowered_dir == "commands" and lowered_file.endswith(".xml"):
                commands.append(rel_path)

    obj_info.forms = sorted(set(forms))
    obj_info.templates = sorted(set(templates))
    obj_info.commands = sorted(set(commands))
    obj_info.properties["module_files"] = "|".join(sorted(set(modules)))


def populate_common_fields(obj_info: ObjectInfo) -> None:
    """Fill common metadata properties from the main XML descriptor."""

    root = load_object_xml(obj_info)
    if root is None:
        return

    obj_info.synonym = obj_info.synonym or get_xml_text(root, ".//*[local-name()='Synonym']/text()", "")
    obj_info.comment = obj_info.comment or get_xml_text(root, ".//*[local-name()='Comment']/text()", "")

    for property_name in (
        "Explanation",
        "Presentation",
        "DefaultListForm",
        "DefaultObjectForm",
        "DefaultChoiceForm",
        "UseStandardCommands",
    ):
        property_value = get_xml_text(root, f".//*[local-name()='{property_name}']/text()", "")
        if property_value:
            obj_info.properties[property_name] = property_value


def _extract_types(type_container) -> List[TypeRef]:
    result: List[TypeRef] = []
    for type_item in parse_types_from_element(type_container):
        result.append(
            TypeRef(
                obj_type=type_item["type"],
                name=type_item["name"],
                full_type=type_item["full_type"],
            )
        )
    return result


def extract_attribute(node, *, tabular_section: str = "", is_dimension: bool = False, is_resource: bool = False) -> Optional[AttributeInfo]:
    name = get_xml_text(node, "./*[local-name()='Name']/text()", "")
    if not name:
        return None

    types = _extract_types(node)
    if not types:
        type_nodes = get_xml_elements(node, ".//*[local-name()='Type' or local-name()='TypeSet']")
        for type_node in type_nodes:
            parsed = parse_type_value(type_node)
            if parsed:
                types.append(
                    TypeRef(
                        obj_type=parsed["type"],
                        name=parsed["name"],
                        full_type=parsed["full_type"],
                    )
                )

    return AttributeInfo(
        name=name,
        types=types,
        is_dimension=is_dimension,
        is_resource=is_resource,
        tabular_section=tabular_section,
    )


def extract_attributes(root) -> List[AttributeInfo]:
    attributes: List[AttributeInfo] = []
    for node in get_xml_elements(root, ".//*[local-name()='Attribute']"):
        if any(_local_name(ancestor.tag) == "TabularSection" for ancestor in node.iterancestors()):
            continue
        attribute = extract_attribute(node)
        if attribute:
            attributes.append(attribute)
    return attributes


def extract_tabular_sections(root) -> List[TabularSectionInfo]:
    sections: List[TabularSectionInfo] = []
    for section_node in get_xml_elements(root, ".//*[local-name()='TabularSection']"):
        name = get_xml_text(section_node, "./*[local-name()='Name']/text()", "")
        attributes: List[AttributeInfo] = []
        for attribute_node in get_xml_elements(section_node, ".//*[local-name()='Attribute']"):
            attribute = extract_attribute(attribute_node, tabular_section=name)
            if attribute:
                attributes.append(attribute)
        if name:
            sections.append(TabularSectionInfo(name=name, attributes=attributes))
    return sections


def extract_dimensions(root) -> List[AttributeInfo]:
    result: List[AttributeInfo] = []
    for node in get_xml_elements(root, ".//*[local-name()='Dimension']"):
        attribute = extract_attribute(node, is_dimension=True)
        if attribute:
            result.append(attribute)
    return result


def extract_resources(root) -> List[AttributeInfo]:
    result: List[AttributeInfo] = []
    for node in get_xml_elements(root, ".//*[local-name()='Resource']"):
        attribute = extract_attribute(node, is_resource=True)
        if attribute:
            result.append(attribute)
    return result


def collect_references(attributes: Iterable[AttributeInfo], ref_kind: str = "attribute") -> List[ReferenceInfo]:
    references: List[ReferenceInfo] = []
    for attribute in attributes:
        for type_ref in attribute.types:
            if type_ref.obj_type not in REFERENCE_TYPES:
                continue
            references.append(
                ReferenceInfo(
                    source_attribute=attribute.name,
                    target_type=type_ref.obj_type,
                    target_name=type_ref.name,
                    tabular_section=attribute.tabular_section,
                    ref_kind=ref_kind,
                )
            )
    return references


def dedupe_references(references: Iterable[ReferenceInfo]) -> List[ReferenceInfo]:
    seen = set()
    result: List[ReferenceInfo] = []
    for reference in references:
        key = (
            reference.source_attribute,
            reference.target_type,
            reference.target_name,
            reference.tabular_section,
            reference.ref_kind,
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(reference)
    return result


def find_module_files(obj_info: ObjectInfo) -> List[str]:
    value = obj_info.properties.get("module_files", "")
    if not value:
        refresh_object_assets(obj_info)
        value = obj_info.properties.get("module_files", "")
    return [item for item in value.split("|") if item]
