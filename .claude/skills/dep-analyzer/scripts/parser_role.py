"""Role and Rights.xml parser with RLS support."""

from __future__ import annotations

import os
from typing import List, Optional

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from xml_helpers import parse_xml_file


def _first_text(element, name: str) -> str:
    values = element.xpath(f".//*[local-name()='{name}'][1]/text()")
    return str(values[0]).strip() if values else ""


def _to_bool(value: str) -> bool:
    return value.strip().lower() in {"true", "1", "yes"}


def _find_rights_xml(obj: ObjectInfo) -> Optional[str]:
    candidates = []
    if obj.path:
        candidates.append(os.path.join(obj.path, "Ext", "Rights.xml"))
    xml_path = obj.properties.get("xml_path", "")
    if xml_path:
        xml_dir = os.path.dirname(xml_path)
        candidates.extend(
            [
                os.path.join(xml_dir, "Ext", "Rights.xml"),
                os.path.join(xml_dir, obj.name, "Ext", "Rights.xml"),
            ]
        )
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


def _parse_metadata_role(obj: ObjectInfo, role_info: RoleInfo) -> None:
    xml_path = obj.properties.get("xml_path", "")
    root = parse_xml_file(xml_path)
    if root is None:
        return
    role_info.synonym = _first_text(root, "Synonym") or role_info.synonym
    role_info.set_for_new_objects = _to_bool(_first_text(root, "SetForNewObjects"))
    raw_default = _first_text(root, "SetForAttributesByDefault")
    if raw_default:
        role_info.set_for_attributes_by_default = _to_bool(raw_default)
    role_info.independent_rights = _to_bool(_first_text(root, "IndependentRightsOfChildObjects"))


def _parse_right_node(node) -> Optional[RightInfo]:
    right_name = _first_text(node, "name") or _first_text(node, "Name")
    value_text = _first_text(node, "value") or _first_text(node, "Value")
    rls_condition = _first_text(node, "restrictionByCondition") or _first_text(node, "RestrictionByCondition")
    has_rls = bool(rls_condition or node.xpath(".//*[local-name()='restrictionByCondition' or local-name()='RestrictionByCondition']"))
    if not right_name:
        return None
    return RightInfo(
        right_name=right_name,
        value=_to_bool(value_text or "true"),
        has_rls=has_rls,
        rls_condition=rls_condition,
    )


def _parse_role_templates(root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    seen = set()
    for node in root.xpath(".//*[local-name()='restrictionTemplate' or local-name()='RestrictionTemplate']"):
        name = _first_text(node, "name") or _first_text(node, "Name")
        condition = _first_text(node, "condition") or _first_text(node, "Condition")
        key = (name, condition)
        if not name or key in seen:
            continue
        seen.add(key)
        templates.append(RLSTemplate(name=name, condition=condition))
    return templates


def _parse_object_rights(root) -> List[ObjectRights]:
    result: List[ObjectRights] = []
    seen = set()
    for node in root.xpath(".//*[local-name()='object' or local-name()='Object']"):
        object_name = _first_text(node, "name") or _first_text(node, "Name")
        if not object_name:
            continue
        rights = []
        for right_node in node.xpath("./*[local-name()='right' or local-name()='Right']"):
            right = _parse_right_node(right_node)
            if right is not None:
                rights.append(right)
        if not rights:
            for right_node in node.xpath(".//*[local-name()='right' or local-name()='Right']"):
                right = _parse_right_node(right_node)
                if right is not None:
                    rights.append(right)
        key = (object_name, tuple((right.right_name, right.value, right.has_rls, right.rls_condition) for right in rights))
        if rights and key not in seen:
            seen.add(key)
            result.append(ObjectRights(object_name=object_name, rights=rights))
    return result


def parse_role(obj: ObjectInfo) -> ObjectInfo:
    role_info = RoleInfo(name=obj.name)
    _parse_metadata_role(obj, role_info)

    rights_path = _find_rights_xml(obj)
    if rights_path:
        rights_root = parse_xml_file(rights_path)
        if rights_root is not None:
            role_info.set_for_new_objects = _to_bool(
                rights_root.get("setForNewObjects", str(role_info.set_for_new_objects))
            )
            if rights_root.get("setForAttributesByDefault") is not None:
                role_info.set_for_attributes_by_default = _to_bool(
                    rights_root.get("setForAttributesByDefault", "true")
                )
            role_info.independent_rights = _to_bool(
                rights_root.get("independentRightsOfChildObjects", str(role_info.independent_rights))
            )
            role_info.object_rights = _parse_object_rights(rights_root)
            role_info.rls_templates = _parse_role_templates(rights_root)
            obj.properties["rights_path"] = rights_path

    obj.role_info = role_info
    obj.synonym = role_info.synonym or obj.synonym
    return obj


def parse_roles(objects: List[ObjectInfo]) -> List[ObjectInfo]:
    for obj in objects:
        parse_role(obj)
    return objects
