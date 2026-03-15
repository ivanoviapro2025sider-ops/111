"""Парсер ролей 1С: Rights.xml, RLS и шаблоны ограничений."""

from __future__ import annotations

import os
from typing import Dict, Optional

from lxml import etree

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from scanner import discover_configuration_root, extract_name, get_type_node, resolve_object_main_xml
from xml_helpers import NSMAP_ROLES, get_xml_text, parse_xml_file


def discover_rights_path(role_path: str) -> Optional[str]:
    candidates = [
        os.path.join(role_path, "Ext", "Rights.xml"),
        os.path.join(role_path, "Rights.xml"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


def _string_to_bool(value: str, default: bool = False) -> bool:
    if value == "":
        return default
    return value.lower() == "true"


def parse_role_object(obj_info: ObjectInfo) -> ObjectInfo:
    """Прочитать основную XML-метаинформацию роли и связанный Rights.xml."""

    role_info = RoleInfo(name=obj_info.name, synonym=obj_info.synonym or "")

    meta_path = resolve_object_main_xml(obj_info.path)
    meta_root = parse_xml_file(meta_path) if meta_path else None
    _obj_type, type_node = get_type_node(meta_root)
    if type_node is not None:
        role_info.name = extract_name(type_node, fallback=role_info.name)
        role_info.synonym = role_info.synonym or get_xml_text(
            type_node,
            "./md:Properties/md:Synonym/v8:item[v8:lang='ru']/v8:content",
        )

    rights_path = discover_rights_path(obj_info.path)
    if not rights_path:
        obj_info.role_info = role_info
        return obj_info

    tree = etree.parse(rights_path, etree.XMLParser(remove_blank_text=False, recover=True))
    root = tree.getroot()
    nsmap = {"r": root.nsmap.get(None) or root.nsmap.get("r") or NSMAP_ROLES["r"]}

    role_info.set_for_new_objects = _string_to_bool(root.get("setForNewObjects", ""), False)
    role_info.set_for_attributes_by_default = _string_to_bool(root.get("setForAttributesByDefault", ""), True)
    role_info.independent_rights = _string_to_bool(root.get("independentRightsOfChildObjects", ""), False)

    for object_node in root.findall("r:object", nsmap):
        object_name = ""
        rights = []
        for child in object_node:
            local = etree.QName(child.tag).localname
            if local == "name":
                object_name = (child.text or "").strip()
                continue
            if local != "right":
                continue

            right_name = ""
            right_value = True
            has_rls = False
            rls_condition = ""
            for right_child in child:
                right_local = etree.QName(right_child.tag).localname
                text = (right_child.text or "").strip()
                if right_local == "name":
                    right_name = text
                elif right_local == "value":
                    right_value = text.lower() == "true"
                elif right_local == "restrictionByCondition":
                    has_rls = True
                    rls_condition = "".join(right_child.itertext()).strip()

            if right_name:
                rights.append(
                    RightInfo(
                        right_name=right_name,
                        value=right_value,
                        has_rls=has_rls,
                        rls_condition=rls_condition,
                    )
                )

        if object_name and rights:
            role_info.object_rights.append(ObjectRights(object_name=object_name, rights=rights))

    for template_node in root.findall("r:restrictionTemplate", nsmap):
        template_name = ""
        condition = ""
        for child in template_node:
            local = etree.QName(child.tag).localname
            text = "".join(child.itertext()).strip()
            if local == "name":
                template_name = text.split("(", 1)[0].strip()
            elif local in {"condition", "text", "expression", "restrictionByCondition"}:
                condition = text
        if template_name:
            role_info.rls_templates.append(RLSTemplate(name=template_name, condition=condition))

    obj_info.role_info = role_info
    return obj_info


def parse_roles(config_path: str, objects: Dict[str, ObjectInfo]) -> Dict[str, RoleInfo]:
    """Собрать роли из индекса и, при необходимости, из каталога Roles."""

    roles: Dict[str, RoleInfo] = {}
    for key, obj_info in list(objects.items()):
        if obj_info.obj_type != "Role":
            continue
        objects[key] = parse_role_object(obj_info)
        if objects[key].role_info is not None:
            roles[objects[key].role_info.name] = objects[key].role_info

    roles_root = os.path.join(discover_configuration_root(config_path), "Roles")
    if not os.path.isdir(roles_root):
        return roles

    for entry in sorted(os.listdir(roles_root)):
        role_dir = os.path.join(roles_root, entry)
        if not os.path.isdir(role_dir):
            continue
        object_key = f"Role.{entry}"
        if object_key not in objects:
            objects[object_key] = ObjectInfo(name=entry, obj_type="Role", path=role_dir)
        objects[object_key] = parse_role_object(objects[object_key])
        if objects[object_key].role_info is not None:
            roles[objects[object_key].role_info.name] = objects[object_key].role_info

    return roles
