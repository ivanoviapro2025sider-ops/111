"""Парсер ролей: Rights.xml, RLS-ограничения, шаблоны."""

import os
from typing import Dict, List, Optional

from models import (
    ObjectInfo, RoleInfo, ObjectRights, RightInfo, RLSTemplate,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    _detect_nsmap, NSMAP, NSMAP_ROLES, NS_ROLES,
)


def parse_roles(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Парсинг всех ролей в индексе."""
    for key, obj in objects.items():
        if obj.obj_type == "Role":
            parse_role(obj)
    return objects


def parse_role(obj_info: ObjectInfo) -> ObjectInfo:
    """Полный парсинг роли: права, RLS, шаблоны."""
    rights_xml_path = _find_rights_xml(obj_info)
    if not rights_xml_path:
        return obj_info

    root = parse_xml_file(rights_xml_path)
    if root is None:
        return obj_info

    nsmap = _build_rights_nsmap(root)

    role_info = RoleInfo(name=obj_info.name)

    _parse_role_properties(role_info, root, nsmap)
    _parse_object_rights(role_info, root, nsmap)
    _parse_rls_templates(role_info, root, nsmap)

    obj_info.role_info = role_info
    return obj_info


def _find_rights_xml(obj_info: ObjectInfo) -> str:
    """Найти Rights.xml для роли."""
    candidates = []
    if obj_info.path:
        if os.path.isdir(obj_info.path):
            candidates.append(os.path.join(obj_info.path, "Ext", "Rights.xml"))
            candidates.append(os.path.join(obj_info.path, "Rights.xml"))
            candidates.append(os.path.join(obj_info.path, f"{obj_info.name}.xml"))
        else:
            parent = os.path.dirname(obj_info.path)
            candidates.append(os.path.join(parent, obj_info.name, "Ext", "Rights.xml"))

    for c in candidates:
        if os.path.isfile(c):
            return c
    return ""


def _build_rights_nsmap(root) -> dict:
    """Построить карту namespaces для Rights.xml."""
    nsmap = dict(NSMAP_ROLES)

    if root is not None and root.nsmap:
        default_ns = root.nsmap.get(None)
        if default_ns:
            nsmap["r"] = default_ns

        for prefix, uri in root.nsmap.items():
            if prefix and prefix not in nsmap:
                nsmap[prefix] = uri

    return nsmap


def _parse_role_properties(role_info: RoleInfo, root, nsmap: dict):
    """Парсинг свойств роли: setForNewObjects, setForAttributesByDefault, etc."""
    sfno_xpaths = [
        ".//r:setForNewObjects",
        "r:setForNewObjects",
        f".//{{{NS_ROLES}}}setForNewObjects",
    ]
    for xp in sfno_xpaths:
        val = get_xml_text(root, xp, nsmap=nsmap)
        if val:
            role_info.set_for_new_objects = val.lower() == "true"
            break

    sfabd_xpaths = [
        ".//r:setForAttributesByDefault",
        "r:setForAttributesByDefault",
        f".//{{{NS_ROLES}}}setForAttributesByDefault",
    ]
    for xp in sfabd_xpaths:
        val = get_xml_text(root, xp, nsmap=nsmap)
        if val:
            role_info.set_for_attributes_by_default = val.lower() != "false"
            break

    ir_xpaths = [
        ".//r:independentRightsOfChildObjects",
        "r:independentRightsOfChildObjects",
        f".//{{{NS_ROLES}}}independentRightsOfChildObjects",
    ]
    for xp in ir_xpaths:
        val = get_xml_text(root, xp, nsmap=nsmap)
        if val:
            role_info.independent_rights = val.lower() == "true"
            break


def _parse_object_rights(role_info: RoleInfo, root, nsmap: dict):
    """Парсинг прав на объекты."""
    obj_xpaths = [
        ".//r:object",
        f".//{{{NS_ROLES}}}object",
    ]

    for xp in obj_xpaths:
        obj_elements = get_xml_elements(root, xp, nsmap)
        if not obj_elements:
            continue

        for obj_el in obj_elements:
            obj_rights = _parse_single_object_rights(obj_el, nsmap)
            if obj_rights:
                role_info.object_rights.append(obj_rights)
        break


def _parse_single_object_rights(obj_el, nsmap: dict) -> Optional[ObjectRights]:
    """Парсинг прав для одного объекта."""
    name_xpaths = [
        "r:name",
        f"{{{NS_ROLES}}}name",
    ]

    obj_name = ""
    for xp in name_xpaths:
        obj_name = get_xml_text(obj_el, xp, nsmap=nsmap)
        if obj_name:
            break

    if not obj_name:
        for child in obj_el:
            tag = _get_local_tag(child)
            if tag == "name" and child.text:
                obj_name = child.text.strip()
                break

    if not obj_name:
        return None

    rights_list: List[RightInfo] = []

    right_xpaths = [
        "r:right",
        f"{{{NS_ROLES}}}right",
    ]

    for xp in right_xpaths:
        right_elements = get_xml_elements(obj_el, xp, nsmap)
        if not right_elements:
            continue

        for right_el in right_elements:
            right_info = _parse_single_right(right_el, nsmap)
            if right_info:
                rights_list.append(right_info)
        break

    if not rights_list:
        for child in obj_el:
            tag = _get_local_tag(child)
            if tag == "right":
                right_info = _parse_single_right(child, nsmap)
                if right_info:
                    rights_list.append(right_info)

    return ObjectRights(object_name=obj_name, rights=rights_list)


def _parse_single_right(right_el, nsmap: dict) -> Optional[RightInfo]:
    """Парсинг одного права."""
    right_name = ""
    value = True
    has_rls = False
    rls_condition = ""

    name_xpaths = ["r:name", f"{{{NS_ROLES}}}name"]
    for xp in name_xpaths:
        right_name = get_xml_text(right_el, xp, nsmap=nsmap)
        if right_name:
            break

    value_xpaths = ["r:value", f"{{{NS_ROLES}}}value"]
    for xp in value_xpaths:
        val = get_xml_text(right_el, xp, nsmap=nsmap)
        if val:
            value = val.lower() == "true"
            break

    if not right_name:
        for child in right_el:
            tag = _get_local_tag(child)
            if tag == "name" and child.text:
                right_name = child.text.strip()
            elif tag == "value" and child.text:
                value = child.text.strip().lower() == "true"

    restriction_xpaths = [
        "r:restrictionByCondition",
        f"{{{NS_ROLES}}}restrictionByCondition",
    ]
    for xp in restriction_xpaths:
        rls_elements = get_xml_elements(right_el, xp, nsmap)
        if rls_elements:
            for rls_el in rls_elements:
                condition_xpaths = ["r:condition", f"{{{NS_ROLES}}}condition"]
                for cxp in condition_xpaths:
                    cond = get_xml_text(rls_el, cxp, nsmap=nsmap)
                    if cond:
                        has_rls = True
                        rls_condition = cond
                        break
                if has_rls:
                    break
            break

    if not has_rls:
        for child in right_el:
            tag = _get_local_tag(child)
            if tag == "restrictionByCondition":
                for sub in child:
                    stag = _get_local_tag(sub)
                    if stag == "condition" and sub.text:
                        has_rls = True
                        rls_condition = sub.text.strip()
                        break

    if not right_name:
        return None

    return RightInfo(
        right_name=right_name,
        value=value,
        has_rls=has_rls,
        rls_condition=rls_condition,
    )


def _parse_rls_templates(role_info: RoleInfo, root, nsmap: dict):
    """Парсинг шаблонов ограничения доступа (RLS templates)."""
    template_xpaths = [
        ".//r:restrictionTemplate",
        f".//{{{NS_ROLES}}}restrictionTemplate",
    ]

    for xp in template_xpaths:
        tmpl_elements = get_xml_elements(root, xp, nsmap)
        if not tmpl_elements:
            continue

        for tmpl_el in tmpl_elements:
            tmpl_name = ""
            tmpl_condition = ""

            name_xpaths = ["r:name", f"{{{NS_ROLES}}}name"]
            for nxp in name_xpaths:
                tmpl_name = get_xml_text(tmpl_el, nxp, nsmap=nsmap)
                if tmpl_name:
                    break

            cond_xpaths = ["r:condition", f"{{{NS_ROLES}}}condition"]
            for cxp in cond_xpaths:
                tmpl_condition = get_xml_text(tmpl_el, cxp, nsmap=nsmap)
                if tmpl_condition:
                    break

            if not tmpl_name:
                for child in tmpl_el:
                    tag = _get_local_tag(child)
                    if tag == "name" and child.text:
                        tmpl_name = child.text.strip()
                    elif tag == "condition" and child.text:
                        tmpl_condition = child.text.strip()

            if tmpl_name:
                role_info.rls_templates.append(RLSTemplate(
                    name=tmpl_name,
                    condition=tmpl_condition,
                ))
        break


def _get_local_tag(element) -> str:
    """Получить локальное имя тега без namespace."""
    tag = element.tag if hasattr(element, "tag") else ""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
