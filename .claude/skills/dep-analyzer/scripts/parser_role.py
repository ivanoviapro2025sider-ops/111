"""Parser for 1C role rights including RLS."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from scanner import iter_object_xml_candidates
from xml_helpers import NSMAP_ROLES, get_xml_elements, get_xml_text, parse_xml_file


def _str_to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    return default


def _detect_role_files(obj_info: ObjectInfo) -> tuple[Path | None, Path | None]:
    main_xml: Path | None = None
    rights_xml: Path | None = None
    for candidate in iter_object_xml_candidates(obj_info):
        if candidate.name.lower() == "rights.xml":
            rights_xml = candidate
        elif main_xml is None:
            main_xml = candidate

    obj_path = Path(obj_info.path)
    if obj_path.is_dir():
        explicit_rights = obj_path / "Rights.xml"
        if explicit_rights.exists():
            rights_xml = explicit_rights
    return main_xml, rights_xml


def _parse_main_role(root, role_name: str) -> RoleInfo:
    return RoleInfo(
        name=role_name,
        synonym=get_xml_text(root, ".//*[local-name()='Synonym']/*[local-name()='item']"),
        set_for_new_objects=_str_to_bool(get_xml_text(root, ".//*[local-name()='SetForNewObjects']")),
        set_for_attributes_by_default=_str_to_bool(
            get_xml_text(root, ".//*[local-name()='SetForAttributesByDefault']"),
            default=True,
        ),
        independent_rights=_str_to_bool(get_xml_text(root, ".//*[local-name()='IndependentRights']")),
    )


def _add_right(
    rights_map: Dict[str, List[RightInfo]],
    object_name: str,
    right_name: str,
    value: bool,
    rls_condition: str = "",
) -> None:
    if not object_name:
        object_name = "_GLOBAL_"
    rights_map.setdefault(object_name, []).append(
        RightInfo(
            right_name=right_name,
            value=value,
            has_rls=bool(rls_condition),
            rls_condition=rls_condition,
        )
    )


def _parse_rights_xml(root, role: RoleInfo) -> None:
    rights_map: Dict[str, List[RightInfo]] = {}

    # RLS templates
    template_nodes = get_xml_elements(
        root,
        ".//*[contains(local-name(),'Template')]",
        nsmap=NSMAP_ROLES,
    )
    for tpl in template_nodes:
        tpl_name = get_xml_text(tpl, "./*[local-name()='Name']", nsmap=NSMAP_ROLES)
        tpl_condition = get_xml_text(
            tpl,
            "./*[local-name()='Condition']|./*[local-name()='Expression']",
            nsmap=NSMAP_ROLES,
        )
        if tpl_name or tpl_condition:
            role.rls_templates.append(RLSTemplate(name=tpl_name, condition=tpl_condition))

    # Generic rights parsing (covers multiple possible role schemas)
    right_nodes = get_xml_elements(
        root,
        ".//*[local-name()='Right' or local-name()='Permission' or contains(local-name(),'Right')]",
        nsmap=NSMAP_ROLES,
    )
    for node in right_nodes:
        right_name = (
            node.get("name")
            or get_xml_text(node, "./*[local-name()='Name']", nsmap=NSMAP_ROLES)
            or node.tag.split("}")[-1]
        )
        right_value_raw = (
            node.get("value")
            or get_xml_text(node, "./*[local-name()='Value']", nsmap=NSMAP_ROLES)
            or (node.text or "")
        )
        right_value = _str_to_bool(right_value_raw, default=True)
        object_name = (
            node.get("object")
            or node.get("objectName")
            or get_xml_text(
                node,
                "./*[local-name()='Object']|./*[local-name()='ObjectName']",
                nsmap=NSMAP_ROLES,
            )
        )
        rls_condition = get_xml_text(
            node,
            "./*[local-name()='RLS']|./*[local-name()='Restriction']|./*[local-name()='Condition']",
            nsmap=NSMAP_ROLES,
        )
        _add_right(rights_map, object_name, right_name, right_value, rls_condition)

    role.object_rights = [
        ObjectRights(object_name=object_name, rights=rights)
        for object_name, rights in sorted(rights_map.items(), key=lambda item: item[0])
    ]


def parse_role(obj_info: ObjectInfo) -> RoleInfo:
    """Parse one role metadata object and return RoleInfo."""
    main_xml, rights_xml = _detect_role_files(obj_info)

    role = RoleInfo(name=obj_info.name)
    if main_xml:
        main_root = parse_xml_file(str(main_xml))
        if main_root is not None:
            role = _parse_main_role(main_root, obj_info.name)

    if rights_xml:
        rights_root = parse_xml_file(str(rights_xml))
        if rights_root is not None:
            _parse_rights_xml(rights_root, role)

    obj_info.role_info = role
    return role


def parse_roles(objects: Dict[str, ObjectInfo]) -> Dict[str, RoleInfo]:
    """Parse all role objects."""
    roles: Dict[str, RoleInfo] = {}
    for obj in objects.values():
        if obj.obj_type != "Role":
            continue
        role = parse_role(obj)
        roles[role.name] = role
    return roles
