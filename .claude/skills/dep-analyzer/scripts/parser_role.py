"""Role parser including rights and RLS templates."""

from __future__ import annotations

import os
from typing import Dict, List, Optional

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from xml_helpers import get_xml_elements, get_xml_text, parse_xml_file


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "да", "истина"}:
        return True
    if normalized in {"false", "0", "no", "нет", "ложь"}:
        return False
    return default


def _resolve_role_xml(obj: ObjectInfo) -> Optional[str]:
    if not obj.path:
        return None
    if os.path.isfile(obj.path) and obj.path.lower().endswith(".xml"):
        return obj.path

    candidates = [
        os.path.join(obj.path, f"{obj.name}.xml"),
        os.path.join(obj.path, "Role.xml"),
        os.path.join(obj.path, "Rights.xml"),
        f"{obj.path}.xml",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _parse_rls_templates(root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    template_nodes = get_xml_elements(
        root,
        ".//*[contains(local-name(),'Template') and not(contains(local-name(),'Templates'))]",
    )
    for node in template_nodes:
        name = (
            get_xml_text(node, "./*[local-name()='Name']/text()")
            or get_xml_text(node, "./@name")
            or get_xml_text(node, "./*[local-name()='ID']/text()")
        )
        condition = (
            get_xml_text(node, ".//*[contains(local-name(),'Condition')]/text()")
            or get_xml_text(node, ".//*[contains(local-name(),'Expression')]/text()")
            or get_xml_text(node, ".//*[contains(local-name(),'Filter')]/text()")
        )
        if name or condition:
            templates.append(RLSTemplate(name=name or "UnnamedTemplate", condition=condition))
    return templates


def _extract_object_name(node) -> str:
    object_name = (
        get_xml_text(node, "./*[local-name()='Object']/text()")
        or get_xml_text(node, "./*[local-name()='MetadataObject']/text()")
        or get_xml_text(node, "./*[local-name()='Name']/text()")
        or get_xml_text(node, "./@name")
        or get_xml_text(node, "./@object")
    )
    return object_name.strip()


def _extract_rights_for_node(node) -> List[RightInfo]:
    rights: List[RightInfo] = []
    rls_condition = (
        get_xml_text(node, ".//*[contains(local-name(),'RLS') and contains(local-name(),'Condition')]/text()")
        or get_xml_text(node, ".//*[contains(local-name(),'Restriction') and contains(local-name(),'Condition')]/text()")
        or get_xml_text(node, ".//*[contains(local-name(),'Filter')]/text()")
    )
    has_rls = bool(rls_condition)

    for child in node:
        local_name = child.tag.split("}")[-1] if isinstance(child.tag, str) else ""
        if local_name in {"Object", "MetadataObject", "Name", "Synonym", "Comment"}:
            continue
        if local_name.lower().endswith("condition") or "template" in local_name.lower():
            continue

        value_text = (child.text or "").strip()
        if value_text == "" and not child.attrib:
            continue

        right_name = child.attrib.get("name", local_name)
        right_value = _to_bool(value_text, default=True)
        rights.append(
            RightInfo(
                right_name=right_name,
                value=right_value,
                has_rls=has_rls,
                rls_condition=rls_condition,
            )
        )

    # Compact <Right name="Read" value="true"/> style.
    for right_node in get_xml_elements(node, ".//*[local-name()='Right']"):
        right_name = (
            get_xml_text(right_node, "./@name")
            or get_xml_text(right_node, "./*[local-name()='Name']/text()")
            or "Right"
        )
        right_value = _to_bool(get_xml_text(right_node, "./@value") or get_xml_text(right_node, "./text()"), default=True)
        if not any(r.right_name == right_name for r in rights):
            rights.append(
                RightInfo(
                    right_name=right_name,
                    value=right_value,
                    has_rls=has_rls,
                    rls_condition=rls_condition,
                )
            )

    return rights


def _parse_object_rights(root) -> List[ObjectRights]:
    result: List[ObjectRights] = []
    object_nodes = get_xml_elements(
        root,
        ".//*[contains(local-name(),'Object') and contains(local-name(),'Right')]"
        " | .//*[contains(local-name(),'Metadata') and contains(local-name(),'Right')]",
    )

    # Fallback for flattened rights structures.
    if not object_nodes:
        object_nodes = get_xml_elements(root, ".//*[local-name()='Rights']/*")

    for node in object_nodes:
        object_name = _extract_object_name(node)
        rights = _extract_rights_for_node(node)
        if object_name and rights:
            result.append(ObjectRights(object_name=object_name, rights=rights))

    return result


def parse_roles(objects: Dict[str, ObjectInfo]) -> Dict[str, RoleInfo]:
    """Parse role metadata and return role dictionary by role name."""
    roles: Dict[str, RoleInfo] = {}

    for obj in objects.values():
        if obj.obj_type != "Role":
            continue

        xml_path = _resolve_role_xml(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        role = RoleInfo(
            name=obj.name,
            synonym=get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item']/text()"),
            set_for_new_objects=_to_bool(get_xml_text(root, ".//*[local-name()='SetForNewObjects']/text()")),
            set_for_attributes_by_default=_to_bool(
                get_xml_text(root, ".//*[local-name()='SetForAttributesByDefault']/text()"),
                default=True,
            ),
            independent_rights=_to_bool(get_xml_text(root, ".//*[local-name()='IndependentRights']/text()")),
        )
        role.object_rights = _parse_object_rights(root)
        role.rls_templates = _parse_rls_templates(root)

        obj.role_info = role
        roles[role.name] = role

    return roles
