"""Парсер ролей: Rights.xml, RLS-условия, шаблоны ограничений."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, DependencyGraph, RoleInfo, ObjectRights, RightInfo,
    RLSTemplate,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    NSMAP_ROLES, NS_ROLES, get_full_object_key,
)
from scanner import get_object_xml_path


def parse_roles(graph: DependencyGraph, config_path: str):
    """Parse all Role objects and populate RoleInfo."""
    roles = graph.get_objects_by_type("Role")
    for obj in roles:
        _parse_single_role(obj, graph, config_path)


def _parse_single_role(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Parse a single role: its Rights.xml and role metadata."""
    role_info = RoleInfo(name=obj.name)

    xml_path = get_object_xml_path(obj)
    if xml_path:
        root = parse_xml_file(xml_path)
        if root:
            role_info.synonym = _find_property_text(root, "Synonym")
            obj.synonym = role_info.synonym

    rights_xml = _find_rights_xml(obj)
    if rights_xml:
        _parse_rights_xml(role_info, rights_xml)

    obj.role_info = role_info
    graph.add_role(role_info)


def _find_rights_xml(obj: ObjectInfo) -> Optional[str]:
    """Locate Rights.xml for a role object."""
    if not obj.path:
        return None

    candidates = [
        os.path.join(obj.path, "Rights.xml"),
        os.path.join(obj.path, "Ext", "Rights.xml"),
        os.path.join(obj.path, obj.name, "Rights.xml"),
        os.path.join(obj.path, obj.name, "Ext", "Rights.xml"),
    ]

    for c in candidates:
        if os.path.isfile(c):
            return c

    if os.path.isdir(obj.path):
        for root_dir, dirs, files in os.walk(obj.path):
            if "Rights.xml" in files:
                return os.path.join(root_dir, "Rights.xml")
            if root_dir.count(os.sep) - obj.path.count(os.sep) > 3:
                break

    return None


def _parse_rights_xml(role_info: RoleInfo, rights_path: str):
    """Parse Rights.xml file."""
    root = parse_xml_file(rights_path)
    if root is None:
        return

    nsmap = _detect_roles_nsmap(root)

    _parse_role_flags(role_info, root, nsmap)
    _parse_object_rights(role_info, root, nsmap)
    _parse_rls_templates(role_info, root, nsmap)


def _detect_roles_nsmap(root) -> dict:
    """Detect namespace map for roles XML."""
    root_nsmap = root.nsmap if hasattr(root, 'nsmap') else {}

    for prefix, uri in root_nsmap.items():
        if "roles" in uri.lower() or "8.2/roles" in uri:
            return {"r": uri, "xs": "http://www.w3.org/2001/XMLSchema",
                    "xsi": "http://www.w3.org/2001/XMLSchema-instance"}

    if root.tag and "}" in root.tag:
        ns = root.tag.split("}")[0].lstrip("{")
        return {"r": ns, "xs": "http://www.w3.org/2001/XMLSchema",
                "xsi": "http://www.w3.org/2001/XMLSchema-instance"}

    return NSMAP_ROLES


def _parse_role_flags(role_info: RoleInfo, root, nsmap: dict):
    """Parse role-level flags."""
    val = get_xml_text(root, ".//r:setForNewObjects", nsmap=nsmap)
    if val.lower() == "true":
        role_info.set_for_new_objects = True

    val = get_xml_text(root, ".//r:setForAttributesByDefault", nsmap=nsmap)
    if val.lower() == "false":
        role_info.set_for_attributes_by_default = False

    val = get_xml_text(root, ".//r:independentRightsOfChildObjects", nsmap=nsmap)
    if val.lower() == "true":
        role_info.independent_rights = True


def _parse_object_rights(role_info: RoleInfo, root, nsmap: dict):
    """Parse <object> sections inside Rights.xml."""
    object_elements = get_xml_elements(root, ".//r:object", nsmap=nsmap)
    if not object_elements:
        object_elements = _find_elements_by_local(root, "object")

    for obj_elem in object_elements:
        obj_name = _get_object_name(obj_elem, nsmap)
        if not obj_name:
            continue

        obj_rights = ObjectRights(object_name=obj_name)

        right_elements = get_xml_elements(obj_elem, ".//r:right", nsmap=nsmap)
        if not right_elements:
            right_elements = _find_direct_children(obj_elem, "right")

        for right_elem in right_elements:
            right_info = _parse_single_right(right_elem, nsmap)
            if right_info:
                obj_rights.rights.append(right_info)

        if obj_rights.rights:
            role_info.object_rights.append(obj_rights)


def _parse_single_right(right_elem, nsmap: dict) -> Optional[RightInfo]:
    """Parse a single <right> element."""
    right_name = get_xml_text(right_elem, ".//r:name", nsmap=nsmap)
    if not right_name:
        right_name = _get_child_text_by_local(right_elem, "name")
    if not right_name:
        return None

    value_text = get_xml_text(right_elem, ".//r:value", nsmap=nsmap)
    if not value_text:
        value_text = _get_child_text_by_local(right_elem, "value")
    value = value_text.lower() == "true" if value_text else True

    rls_condition = ""
    has_rls = False

    restriction_elements = get_xml_elements(right_elem, ".//r:restrictionByCondition", nsmap=nsmap)
    if not restriction_elements:
        restriction_elements = _find_direct_children(right_elem, "restrictionByCondition")

    for rls_elem in restriction_elements:
        condition = get_xml_text(rls_elem, ".//r:condition", nsmap=nsmap)
        if not condition:
            condition = _get_child_text_by_local(rls_elem, "condition")
        if condition:
            has_rls = True
            rls_condition = condition
            break

    return RightInfo(
        right_name=right_name,
        value=value,
        has_rls=has_rls,
        rls_condition=rls_condition,
    )


def _parse_rls_templates(role_info: RoleInfo, root, nsmap: dict):
    """Parse RLS templates (restrictionTemplates)."""
    template_elements = get_xml_elements(root, ".//r:restrictionTemplate", nsmap=nsmap)
    if not template_elements:
        template_elements = _find_elements_by_local(root, "restrictionTemplate")

    for tpl_elem in template_elements:
        name = get_xml_text(tpl_elem, ".//r:name", nsmap=nsmap)
        if not name:
            name = _get_child_text_by_local(tpl_elem, "name")

        condition = get_xml_text(tpl_elem, ".//r:condition", nsmap=nsmap)
        if not condition:
            condition = _get_child_text_by_local(tpl_elem, "condition")

        if name:
            role_info.rls_templates.append(RLSTemplate(
                name=name,
                condition=condition or "",
            ))


def _get_object_name(obj_elem, nsmap: dict) -> str:
    """Extract the object name from an <object> element."""
    name = get_xml_text(obj_elem, ".//r:name", nsmap=nsmap)
    if name:
        return name

    name = _get_child_text_by_local(obj_elem, "name")
    if name:
        return name

    name = obj_elem.get("name", "")
    if name:
        return name

    return (obj_elem.text or "").strip()


def _find_elements_by_local(root, local_name: str) -> list:
    result = []
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            result.append(elem)
    return result


def _find_direct_children(elem, local_name: str) -> list:
    result = []
    for child in elem:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            result.append(child)
    return result


def _get_child_text_by_local(elem, child_local_name: str) -> str:
    for child in elem:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == child_local_name:
            return (child.text or "").strip()
    return ""


def _find_property_text(root, prop_name: str) -> str:
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == prop_name:
            if elem.text:
                return elem.text.strip()
            for child in elem:
                child_tag = child.tag
                if "}" in child_tag:
                    child_tag = child_tag.split("}", 1)[1]
                if child_tag in ("v", "Content"):
                    return (child.text or "").strip()
    return ""
