"""Parser for 1C role metadata and rights (including RLS)."""

from __future__ import annotations

import os
from typing import List

from lxml import etree

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from xml_helpers import NSMAP_ROLES, get_xml_elements, get_xml_text, parse_xml_file


KNOWN_RIGHTS = {
    "Read",
    "Insert",
    "Update",
    "Delete",
    "View",
    "InteractiveDelete",
    "Use",
    "Execute",
    "Post",
    "UndoPost",
    "InputByString",
    "Edit",
}


def _extract_object_name(file_path: str) -> str:
    base = os.path.basename(file_path)
    if base.lower() == "object.xml":
        return os.path.basename(os.path.dirname(file_path))
    return os.path.splitext(base)[0]


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes", "истина", "да"}:
        return True
    if normalized in {"false", "0", "no", "ложь", "нет"}:
        return False
    return default


def _tag_name(node) -> str:
    try:
        return etree.QName(node).localname
    except Exception:
        return ""


def _parse_rls_templates(root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    template_nodes = get_xml_elements(root, ".//*[contains(local-name(),'Template')]")
    for node in template_nodes:
        name = (
            get_xml_text(node, ".//*[local-name()='Name']")
            or node.attrib.get("name", "")
            or _tag_name(node)
        )
        condition = (
            get_xml_text(node, ".//*[contains(local-name(),'Condition')]")
            or get_xml_text(node, ".//*[contains(local-name(),'Restriction')]")
            or (node.text or "").strip()
        )
        if name and condition:
            templates.append(RLSTemplate(name=name, condition=condition))
    unique = {}
    for template in templates:
        unique[(template.name, template.condition)] = template
    return list(unique.values())


def _extract_right_from_node(node) -> List[RightInfo]:
    rights: List[RightInfo] = []
    right_name = node.attrib.get("name", "")
    if right_name in KNOWN_RIGHTS:
        value = _to_bool(node.attrib.get("value", node.text or "true"), default=True)
        condition = (
            get_xml_text(node, ".//*[contains(local-name(),'Condition')]")
            or get_xml_text(node, ".//*[contains(local-name(),'Restriction')]")
        )
        rights.append(RightInfo(right_name=right_name, value=value, has_rls=bool(condition), rls_condition=condition))

    for child in list(node):
        child_name = _tag_name(child)
        if child_name not in KNOWN_RIGHTS:
            continue
        value = _to_bool(child.attrib.get("value", child.text or "true"), default=True)
        condition = (
            get_xml_text(child, ".//*[contains(local-name(),'Condition')]")
            or get_xml_text(child, ".//*[contains(local-name(),'Restriction')]")
        )
        rights.append(RightInfo(right_name=child_name, value=value, has_rls=bool(condition), rls_condition=condition))
    return rights


def _parse_object_rights(root) -> List[ObjectRights]:
    object_rights_map = {}

    # Common role formats: ObjectRight, Right, RightOnObject.
    object_nodes = get_xml_elements(
        root,
        ".//*[local-name()='ObjectRight' or local-name()='RightOnObject' or local-name()='Object']",
    )
    for node in object_nodes:
        object_name = (
            get_xml_text(node, ".//*[local-name()='Name']")
            or node.attrib.get("object", "")
            or node.attrib.get("name", "")
        )
        if not object_name:
            continue
        rights = _extract_right_from_node(node)
        if not rights:
            continue
        bucket = object_rights_map.setdefault(object_name, [])
        bucket.extend(rights)

    # Fallback format: <Right object="Catalog.Номенклатура" name="Read" value="true"/>
    for node in get_xml_elements(root, ".//*[local-name()='Right']"):
        object_name = node.attrib.get("object", "")
        if not object_name:
            continue
        bucket = object_rights_map.setdefault(object_name, [])
        bucket.extend(_extract_right_from_node(node))

    result: List[ObjectRights] = []
    for object_name, rights in object_rights_map.items():
        dedup = {}
        for right in rights:
            dedup[(right.right_name, right.value, right.has_rls, right.rls_condition)] = right
        result.append(ObjectRights(object_name=object_name, rights=list(dedup.values())))
    return sorted(result, key=lambda item: item.object_name)


def _load_rights_xml_from_role(role_xml_path: str):
    base_dir = os.path.dirname(role_xml_path)
    candidates = [
        os.path.join(base_dir, "Ext", "Rights.xml"),
        os.path.join(base_dir, "Rights.xml"),
        role_xml_path.replace(".xml", ".Rights.xml"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            root = parse_xml_file(candidate)
            if root is not None:
                return root
    return None


def parse_role(role_xml_path: str) -> ObjectInfo:
    """Parse role XML (+ optional Rights.xml) into ObjectInfo with RoleInfo payload."""
    root = parse_xml_file(role_xml_path)
    role_name = _extract_object_name(role_xml_path)
    role_info = RoleInfo(name=role_name)

    if root is not None:
        role_info.synonym = (
            get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item'][1]")
            or get_xml_text(root, ".//*[local-name()='Synonym']")
        )
        role_info.set_for_new_objects = _to_bool(get_xml_text(root, ".//*[local-name()='SetForNewObjects']"), default=False)
        role_info.set_for_attributes_by_default = _to_bool(
            get_xml_text(root, ".//*[local-name()='SetForAttributesByDefault']"), default=True
        )
        role_info.independent_rights = _to_bool(get_xml_text(root, ".//*[local-name()='IndependentRights']"), default=False)
        role_info.rls_templates.extend(_parse_rls_templates(root))
        role_info.object_rights.extend(_parse_object_rights(root))

    rights_root = _load_rights_xml_from_role(role_xml_path)
    if rights_root is not None:
        # Try roles namespace first, then fallback to local-name XPath.
        try:
            object_nodes = rights_root.xpath(".//r:Object", namespaces=NSMAP_ROLES)
        except Exception:
            object_nodes = []
        if object_nodes:
            parsed = []
            for node in object_nodes:
                object_name = node.attrib.get("name", "")
                rights = []
                for right_node in node:
                    right_name = _tag_name(right_node)
                    if right_name not in KNOWN_RIGHTS:
                        continue
                    condition = (
                        get_xml_text(right_node, ".//*[contains(local-name(),'Condition')]")
                        or get_xml_text(right_node, ".//*[contains(local-name(),'Restriction')]")
                    )
                    rights.append(
                        RightInfo(
                            right_name=right_name,
                            value=_to_bool(right_node.text or right_node.attrib.get("value", "true"), default=True),
                            has_rls=bool(condition),
                            rls_condition=condition,
                        )
                    )
                if object_name and rights:
                    parsed.append(ObjectRights(object_name=object_name, rights=rights))
            if parsed:
                role_info.object_rights = parsed
        else:
            role_info.rls_templates.extend(_parse_rls_templates(rights_root))
            role_info.object_rights.extend(_parse_object_rights(rights_root))

    # Normalize and dedupe rights/templates collected from multiple sources.
    rights_map = {}
    for object_rights in role_info.object_rights:
        key = object_rights.object_name
        bucket = rights_map.setdefault(key, [])
        bucket.extend(object_rights.rights)
    role_info.object_rights = []
    for object_name, rights in rights_map.items():
        dedup = {}
        for right in rights:
            dedup[(right.right_name, right.value, right.has_rls, right.rls_condition)] = right
        role_info.object_rights.append(ObjectRights(object_name=object_name, rights=list(dedup.values())))
    role_info.object_rights.sort(key=lambda item: item.object_name)

    templates = {}
    for template in role_info.rls_templates:
        templates[(template.name, template.condition)] = template
    role_info.rls_templates = list(templates.values())

    role_object = ObjectInfo(name=role_name, obj_type="Role", path=os.path.dirname(role_xml_path), role_info=role_info)
    return role_object


def parse_role_files(role_xml_paths: List[str]) -> List[ObjectInfo]:
    return [parse_role(path) for path in role_xml_paths]
