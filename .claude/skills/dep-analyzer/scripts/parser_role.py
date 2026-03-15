"""Парсер ролей: Rights.xml, RLS-условия, шаблоны ограничений."""
import os
from typing import List, Optional

from models import (
    ObjectInfo, DependencyGraph, RoleInfo, ObjectRights,
    RightInfo, RLSTemplate,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    get_full_object_key, _detect_nsmap, NSMAP, NSMAP_ROLES, NS_ROLES,
)


def parse_roles(graph: DependencyGraph, config_path: str):
    """Разобрать все роли и заполнить RoleInfo."""
    for key, obj in list(graph.objects.items()):
        if obj.obj_type != "Role":
            continue
        _parse_one_role(obj, graph, config_path)


def _parse_one_role(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    role_dir = obj.path
    if not role_dir or not os.path.isdir(role_dir):
        return

    xml_path = os.path.join(role_dir, f"{obj.name}.xml")
    if os.path.exists(xml_path):
        _parse_role_xml(xml_path, obj)

    rights_path = os.path.join(role_dir, "Ext", "Rights.xml")
    if os.path.exists(rights_path):
        _parse_rights_xml(rights_path, obj, graph)

    if obj.role_info:
        graph.add_role(obj.role_info)


def _parse_role_xml(xml_path: str, obj: ObjectInfo):
    """Парсинг основного XML роли (имя, синоним и т.д.)."""
    root = parse_xml_file(xml_path)
    if root is None:
        return

    nsmap = _detect_nsmap(root)

    if obj.role_info is None:
        obj.role_info = RoleInfo(name=obj.name)

    obj.role_info.synonym = get_xml_text(root, ".//md:Properties/md:Synonym/v8:item/v8:content", "", nsmap)
    if not obj.role_info.synonym:
        obj.role_info.synonym = get_xml_text(root, ".//md:Properties/md:Synonym", "", nsmap)
    obj.synonym = obj.role_info.synonym


def _parse_rights_xml(rights_path: str, obj: ObjectInfo, graph: DependencyGraph):
    """Парсинг Rights.xml — права на объекты, RLS, шаблоны."""
    root = parse_xml_file(rights_path)
    if root is None:
        return

    if obj.role_info is None:
        obj.role_info = RoleInfo(name=obj.name)

    role = obj.role_info
    nsmap = _build_roles_nsmap(root)

    _parse_role_flags(root, role, nsmap)
    _parse_object_rights(root, role, nsmap)
    _parse_rls_templates(root, role, nsmap)


def _build_roles_nsmap(root) -> dict:
    """Определить namespace map для Rights.xml."""
    declared = root.nsmap if hasattr(root, 'nsmap') else {}

    nsmap = dict(NSMAP_ROLES)

    for prefix, uri in declared.items():
        if uri and "roles" in uri.lower():
            nsmap["r"] = uri
            break

    if None in declared and "roles" in declared[None].lower():
        nsmap["r"] = declared[None]

    return nsmap


def _parse_role_flags(root, role: RoleInfo, nsmap: dict):
    """Парсинг общих флагов роли."""
    val = get_xml_text(root, ".//r:setForNewObjects", "false", nsmap)
    role.set_for_new_objects = val.lower() == "true"

    val = get_xml_text(root, ".//r:setForAttributesByDefault", "true", nsmap)
    role.set_for_attributes_by_default = val.lower() != "false"

    val = get_xml_text(root, ".//r:independentRightsOfChildObjects", "false", nsmap)
    role.independent_rights = val.lower() == "true"


def _parse_object_rights(root, role: RoleInfo, nsmap: dict):
    """Парсинг прав на объекты."""
    for obj_el in get_xml_elements(root, ".//r:object", nsmap):
        obj_name = _get_object_name_from_rights(obj_el, nsmap)
        if not obj_name:
            continue

        obj_rights = ObjectRights(object_name=obj_name)

        for right_el in get_xml_elements(obj_el, "r:right", nsmap):
            right_name = get_xml_text(right_el, "r:name", "", nsmap)
            right_value = get_xml_text(right_el, "r:value", "false", nsmap).lower() == "true"

            right_info = RightInfo(right_name=right_name, value=right_value)

            rls_el = get_xml_elements(right_el, "r:restrictionByCondition", nsmap)
            if rls_el:
                condition = get_xml_text(rls_el[0], "r:condition", "", nsmap)
                if condition:
                    right_info.has_rls = True
                    right_info.rls_condition = condition

            obj_rights.rights.append(right_info)

        if obj_rights.rights:
            role.object_rights.append(obj_rights)


def _parse_rls_templates(root, role: RoleInfo, nsmap: dict):
    """Парсинг шаблонов ограничений доступа (restrictionTemplate)."""
    for tmpl_el in get_xml_elements(root, ".//r:restrictionTemplate", nsmap):
        name = get_xml_text(tmpl_el, "r:name", "", nsmap)
        condition = get_xml_text(tmpl_el, "r:condition", "", nsmap)

        if not condition:
            text_parts = []
            for child in tmpl_el:
                local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if local == "condition" and child.text:
                    text_parts.append(child.text.strip())
            condition = "\n".join(text_parts)

        if name:
            role.rls_templates.append(RLSTemplate(name=name, condition=condition))


def _get_object_name_from_rights(obj_el, nsmap: dict) -> str:
    """Извлечь имя объекта из элемента <object> в Rights.xml.
    Формат: может быть атрибут или вложенный текст."""
    name = obj_el.get("name", "")
    if name:
        return name.strip()

    name_el = get_xml_elements(obj_el, "r:name", nsmap)
    if name_el:
        return (name_el[0].text or "").strip()

    if hasattr(obj_el, 'text') and obj_el.text and obj_el.text.strip():
        lines = obj_el.text.strip().split("\n")
        if lines:
            return lines[0].strip()

    return ""


def get_rights_for_object(graph: DependencyGraph, object_key: str) -> List[dict]:
    """Получить сводку прав всех ролей на указанный объект.
    Возвращает список {'role': ..., 'right': ..., 'value': ..., 'has_rls': ..., 'rls': ...}."""
    results = []
    for role_name, role in graph.roles.items():
        for obj_rights in role.object_rights:
            if _match_object_key(obj_rights.object_name, object_key):
                for ri in obj_rights.rights:
                    results.append({
                        "role": role_name,
                        "right": ri.right_name,
                        "value": ri.value,
                        "has_rls": ri.has_rls,
                        "rls": ri.rls_condition,
                    })
    return results


def _match_object_key(rights_obj_name: str, object_key: str) -> bool:
    """Проверить соответствие имени объекта из Rights.xml ключу графа."""
    if rights_obj_name == object_key:
        return True
    normalized = rights_obj_name.replace(".", ".")
    if normalized == object_key:
        return True
    if object_key.endswith(f".{rights_obj_name}"):
        return True
    return False
