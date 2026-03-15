"""Парсер ролей: Rights.xml, RLS, шаблоны ограничения доступа."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, RoleInfo, ObjectRights, RightInfo, RLSTemplate,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    get_type_folder, NSMAP_ROLES,
)


def parse_role(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Распарсить роль: основной XML + Rights.xml."""
    _parse_role_xml(config_path, obj_info)
    _parse_rights_xml(config_path, obj_info)
    return obj_info


def _parse_role_xml(config_path: str, obj_info: ObjectInfo):
    """Парсинг основного XML файла роли."""
    folder = get_type_folder("Role")
    candidates = [
        os.path.join(config_path, folder, obj_info.name + ".xml"),
        os.path.join(config_path, folder, obj_info.name, obj_info.name + ".xml"),
    ]

    root = None
    for c in candidates:
        root = parse_xml_file(c)
        if root is not None:
            break

    if root is None:
        return

    role_el = _find_role_element(root)
    obj_info.synonym = _get_property_text(role_el, "Synonym")


def _parse_rights_xml(config_path: str, obj_info: ObjectInfo):
    """Парсинг Rights.xml — права на объекты, RLS, шаблоны."""
    folder = get_type_folder("Role")
    rights_candidates = [
        os.path.join(config_path, folder, obj_info.name, "Ext", "Rights.xml"),
        os.path.join(config_path, folder, obj_info.name, "Rights.xml"),
    ]

    root = None
    for c in rights_candidates:
        root = parse_xml_file(c)
        if root is not None:
            break

    if root is None:
        return

    role_info = RoleInfo(name=obj_info.name, synonym=obj_info.synonym)

    role_info.set_for_new_objects = _get_bool_attr(root, "setForNewObjects")
    role_info.set_for_attributes_by_default = _get_bool_attr(root, "setForAttributesByDefault", True)
    role_info.independent_rights = _get_bool_attr(root, "independentRightsOfChildObjects")

    _parse_object_rights(root, role_info)
    _parse_rls_templates(root, role_info)

    obj_info.role_info = role_info


def _parse_object_rights(root, role_info: RoleInfo):
    """Парсинг прав на объекты из Rights.xml."""
    object_elems = get_xml_elements(root, ".//r:object", nsmap=NSMAP_ROLES)
    if not object_elems:
        object_elems = _find_elements_by_local_name(root, "object")

    for obj_elem in object_elems:
        obj_name = _get_element_text_child(obj_elem, "name")
        if not obj_name:
            obj_name = obj_elem.get("name", "")
        if not obj_name:
            continue

        obj_rights = ObjectRights(object_name=obj_name)

        right_elems = get_xml_elements(obj_elem, ".//r:right", nsmap=NSMAP_ROLES)
        if not right_elems:
            right_elems = _find_elements_by_local_name(obj_elem, "right")

        for re_elem in right_elems:
            right_name = _get_element_text_child(re_elem, "name")
            if not right_name:
                continue

            value_text = _get_element_text_child(re_elem, "value")
            value = value_text.lower() in ("true", "1") if value_text else True

            rls_condition = ""
            has_rls = False

            restriction_elems = _find_elements_by_local_name(re_elem, "restrictionByCondition")
            if restriction_elems:
                for rls_elem in restriction_elems:
                    condition = _get_element_text_child(rls_elem, "condition")
                    if condition:
                        has_rls = True
                        rls_condition = condition.strip()

            if not has_rls:
                rls_elems = _find_elements_by_local_name(re_elem, "condition")
                if rls_elems:
                    for rls_el in rls_elems:
                        text = (rls_el.text or "").strip()
                        if text:
                            has_rls = True
                            rls_condition = text

            obj_rights.rights.append(RightInfo(
                right_name=right_name,
                value=value,
                has_rls=has_rls,
                rls_condition=rls_condition,
            ))

        if obj_rights.rights:
            role_info.object_rights.append(obj_rights)


def _parse_rls_templates(root, role_info: RoleInfo):
    """Парсинг шаблонов ограничения доступа."""
    template_elems = get_xml_elements(root, ".//r:restrictionTemplate", nsmap=NSMAP_ROLES)
    if not template_elems:
        template_elems = _find_elements_by_local_name(root, "restrictionTemplate")

    for tpl_elem in template_elems:
        name = _get_element_text_child(tpl_elem, "name")
        condition = _get_element_text_child(tpl_elem, "condition")
        if not condition:
            condition = _get_element_text_child(tpl_elem, "template")

        if name:
            role_info.rls_templates.append(RLSTemplate(
                name=name,
                condition=condition or "",
            ))


def _find_role_element(root):
    for child in root:
        local = _local_tag(child.tag)
        if local == "Role":
            return child
    from xml_helpers import NSMAP
    elems = get_xml_elements(root, ".//md:Role", nsmap=NSMAP)
    return elems[0] if elems else root


def _get_property_text(element, prop_name: str) -> str:
    from xml_helpers import NSMAP
    paths = [
        f".//md:Properties/md:{prop_name}/md:Value",
        f".//md:Properties/md:{prop_name}",
        f".//{prop_name}",
    ]
    for p in paths:
        val = get_xml_text(element, p, nsmap=NSMAP)
        if val:
            return val
    v8_paths = [
        f".//md:Properties/md:{prop_name}//v8:item/v8:content",
        f".//md:{prop_name}//v8:item/v8:content",
    ]
    for p in v8_paths:
        val = get_xml_text(element, p, nsmap=NSMAP)
        if val:
            return val
    return ""


def _get_bool_attr(root, attr_name: str, default: bool = False) -> bool:
    val = root.get(attr_name, "")
    if not val:
        child = _get_element_text_child(root, attr_name)
        if child:
            val = child
    if val:
        return val.lower() in ("true", "1")
    return default


def _get_element_text_child(element, child_local_name: str) -> str:
    """Найти дочерний элемент по локальному имени и вернуть его текст."""
    for child in element:
        local = _local_tag(child.tag)
        if local == child_local_name:
            return (child.text or "").strip()
    return ""


def _find_elements_by_local_name(element, local_name: str) -> list:
    """Найти все дочерние элементы по локальному имени (без учёта namespace)."""
    result = []
    for child in element:
        local = _local_tag(child.tag)
        if local == local_name:
            result.append(child)
    return result


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag
