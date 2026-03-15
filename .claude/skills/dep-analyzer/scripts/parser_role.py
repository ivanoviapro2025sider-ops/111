"""Role parser: rights, RLS and templates."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from models import ObjectRights, RLSTemplate, RightInfo, RoleInfo
from xml_helpers import NSMAP_ROLES, get_xml_elements, get_xml_text, parse_xml_file


def _guess_role_xml(role_dir: Path, role_name: str) -> Optional[Path]:
    candidates = [
        role_dir / f"{role_name}.xml",
        role_dir / "Rights.xml",
    ]
    candidates.extend(sorted(role_dir.glob("*.xml")))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"true", "1", "yes"}


def _parse_object_rights(root) -> List[ObjectRights]:
    result: List[ObjectRights] = []

    right_nodes = get_xml_elements(root, ".//*[local-name()='Right']")
    # Попытка через namespace roles
    if not right_nodes:
        right_nodes = get_xml_elements(root, ".//r:Right", nsmap=NSMAP_ROLES)

    by_object = {}

    for node in right_nodes:
        object_name = (
            get_xml_text(node, ".//*[local-name()='Object']")
            or get_xml_text(node, ".//*[local-name()='Metadata']")
            or get_xml_text(node, ".//*[local-name()='Name']")
        )
        right_name = (
            get_xml_text(node, ".//*[local-name()='RightName']")
            or get_xml_text(node, ".//*[local-name()='Name']")
            or "UnknownRight"
        )

        value_text = (
            get_xml_text(node, ".//*[local-name()='Value']", default="true")
            or (getattr(node, "text", "") or "true")
        )
        has_rls = _to_bool(get_xml_text(node, ".//*[local-name()='UseRestrictionByCondition']"), default=False)
        rls_condition = (
            get_xml_text(node, ".//*[local-name()='RestrictionByCondition']")
            or get_xml_text(node, ".//*[local-name()='Condition']")
        )

        if not object_name:
            continue

        right_info = RightInfo(
            right_name=right_name,
            value=_to_bool(value_text, default=True),
            has_rls=has_rls or bool(rls_condition.strip()),
            rls_condition=rls_condition.strip(),
        )
        by_object.setdefault(object_name, []).append(right_info)

    for object_name, rights in by_object.items():
        result.append(ObjectRights(object_name=object_name, rights=rights))
    return result


def _parse_rls_templates(root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    for node in get_xml_elements(root, ".//*[local-name()='Template']"):
        name = get_xml_text(node, ".//*[local-name()='Name']")
        condition = (
            get_xml_text(node, ".//*[local-name()='Condition']")
            or get_xml_text(node, ".//*[local-name()='Text']")
        )
        if name:
            templates.append(RLSTemplate(name=name, condition=condition))
    return templates


def parse_roles(graph) -> None:
    for obj in graph.objects.values():
        if obj.obj_type != "Role":
            continue

        role_dir = Path(obj.path)
        role_xml = _guess_role_xml(role_dir, obj.name)
        if role_xml is None:
            continue

        root = parse_xml_file(str(role_xml))
        if root is None:
            continue

        role = RoleInfo(
            name=obj.name,
            synonym=(
                get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='Item']")
                or get_xml_text(root, ".//*[local-name()='Synonym']")
            ),
            set_for_new_objects=_to_bool(get_xml_text(root, ".//*[local-name()='SetForNewObjects']")),
            set_for_attributes_by_default=_to_bool(
                get_xml_text(root, ".//*[local-name()='SetForAttributesByDefault']", default="true"),
                default=True,
            ),
            independent_rights=_to_bool(get_xml_text(root, ".//*[local-name()='IndependentRights']")),
            object_rights=_parse_object_rights(root),
            rls_templates=_parse_rls_templates(root),
        )

        graph.add_role(role)
        obj.role_info = role

