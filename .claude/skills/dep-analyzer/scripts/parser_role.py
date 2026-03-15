"""Parser for 1C roles, rights, and RLS restrictions."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from xml_helpers import parse_xml_file


def _text_of_first(element, *names: str) -> str:
    for name in names:
        found = element.xpath(f"./*[local-name()='{name}']")
        if found:
            value = "".join(found[0].itertext()).strip()
            if value:
                return value
    return ""


def _bool_from_text(value: str, default: bool = False) -> bool:
    if not value:
        return default
    return value.strip().lower() in {"true", "1", "yes"}


def _locate_rights_xml(obj_info: ObjectInfo) -> str:
    base_path = Path(obj_info.path)
    candidates = [
        base_path / "Ext" / "Rights.xml",
        base_path / "Rights.xml",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    for candidate in base_path.rglob("Rights.xml"):
        return str(candidate)
    return ""


def _parse_rls_templates(rights_root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    seen = set()
    for node in rights_root.xpath(
        ".//*[local-name()='RestrictionTemplate' or local-name()='RestrictionByConditionTemplate' or local-name()='RLSTemplate']"
    ):
        name = _text_of_first(node, "Name") or node.get("name") or node.get("Name") or ""
        condition = _text_of_first(node, "Condition", "Value", "Text") or "".join(node.itertext()).strip()
        if not name:
            continue
        signature = (name, condition)
        if signature in seen:
            continue
        seen.add(signature)
        templates.append(RLSTemplate(name=name, condition=condition))
    return templates


def _parse_right_node(right_node) -> RightInfo:
    right_name = _text_of_first(right_node, "Name") or right_node.get("name") or right_node.get("Name") or right_node.tag.split("}", 1)[-1]
    value = _bool_from_text(_text_of_first(right_node, "Value") or right_node.get("value") or right_node.get("Value") or "true", default=True)
    condition = _text_of_first(right_node, "Condition", "RestrictionByCondition", "RestrictionCondition")
    has_rls = bool(condition or right_node.xpath(".//*[local-name()='Condition' or local-name()='RestrictionByCondition' or local-name()='RestrictionCondition']"))
    if not condition and has_rls:
        condition = " ".join("".join(node.itertext()).strip() for node in right_node.xpath(".//*[local-name()='Condition' or local-name()='RestrictionByCondition' or local-name()='RestrictionCondition']") if "".join(node.itertext()).strip())
    return RightInfo(right_name=right_name, value=value, has_rls=has_rls, rls_condition=condition)


def _parse_object_rights(rights_root) -> List[ObjectRights]:
    object_rights: List[ObjectRights] = []
    seen_objects = set()

    for object_node in rights_root.xpath(".//*[local-name()='Object' or local-name()='RightObject']"):
        object_name = (
            _text_of_first(object_node, "Name", "ObjectName", "FullName")
            or object_node.get("name")
            or object_node.get("Name")
            or ""
        )
        if not object_name:
            continue

        rights: List[RightInfo] = []
        for right_node in object_node.xpath("./*[local-name()='Right']"):
            rights.append(_parse_right_node(right_node))

        for field_node in object_node.xpath("./*[local-name()='Field' or local-name()='Attribute']"):
            field_name = _text_of_first(field_node, "Name") or field_node.get("name") or field_node.get("Name") or ""
            if not field_name:
                continue
            field_rights: List[RightInfo] = []
            for right_node in field_node.xpath("./*[local-name()='Right']"):
                field_rights.append(_parse_right_node(right_node))
            if field_rights:
                object_rights.append(ObjectRights(object_name=f"{object_name}.Attribute.{field_name}", rights=field_rights))

        if not rights:
            pseudo_rights = []
            for child in object_node.xpath("./*"):
                local_name = child.tag.split("}", 1)[-1]
                if local_name in {"Name", "ObjectName", "FullName", "Field", "Attribute"}:
                    continue
                if child.xpath("./*[local-name()='Name' or local-name()='Value']"):
                    continue
                text = "".join(child.itertext()).strip()
                if text.lower() not in {"true", "false", "1", "0", "yes", "no"}:
                    continue
                pseudo_rights.append(
                    RightInfo(
                        right_name=local_name,
                        value=_bool_from_text(text, default=False),
                    )
                )
            rights.extend(pseudo_rights)

        if rights and object_name not in seen_objects:
            object_rights.append(ObjectRights(object_name=object_name, rights=rights))
            seen_objects.add(object_name)

    return object_rights


def parse_roles(object_index: Dict[str, ObjectInfo]) -> Dict[str, RoleInfo]:
    """Parse all role objects and return a map of role names to RoleInfo."""

    roles: Dict[str, RoleInfo] = {}
    for obj_info in object_index.values():
        if obj_info.obj_type != "Role":
            continue

        role_root = parse_xml_file(obj_info.properties.get("xml_path", ""))
        rights_root = parse_xml_file(_locate_rights_xml(obj_info))

        role_info = RoleInfo(name=obj_info.name)
        if role_root is not None:
            role_info.synonym = _text_of_first(role_root, "Synonym", "Presentation")
            role_info.set_for_new_objects = _bool_from_text(_text_of_first(role_root, "SetForNewObjects"))
            role_info.set_for_attributes_by_default = _bool_from_text(
                _text_of_first(role_root, "SetForAttributesByDefault"),
                default=True,
            )
            role_info.independent_rights = _bool_from_text(
                _text_of_first(role_root, "IndependentRightsOfChildObjects"),
                default=False,
            )

        if rights_root is not None:
            role_info.object_rights = _parse_object_rights(rights_root)
            role_info.rls_templates = _parse_rls_templates(rights_root)
            if not role_info.set_for_new_objects:
                role_info.set_for_new_objects = _bool_from_text(_text_of_first(rights_root, "SetForNewObjects"))
            if role_info.set_for_attributes_by_default:
                role_info.set_for_attributes_by_default = _bool_from_text(
                    _text_of_first(rights_root, "SetForAttributesByDefault"),
                    default=True,
                )
            if not role_info.independent_rights:
                role_info.independent_rights = _bool_from_text(
                    _text_of_first(rights_root, "IndependentRightsOfChildObjects"),
                    default=False,
                )

        obj_info.role_info = role_info
        roles[role_info.name] = role_info

    return roles
