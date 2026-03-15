"""Вывод: режим rights (text/json/md) — аудит прав и RLS."""

import json
from typing import Dict, List, Optional

from models import DependencyGraph, RoleInfo, ObjectRights, RightInfo, ObjectInfo
from xml_helpers import get_type_ru


def format_rights_text(graph: DependencyGraph, target: Optional[str] = None,
                       depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование прав в текстовый формат."""
    lines: List[str] = []

    if target:
        lines.append(f"=== Права на объект: {target} (глубина: {depth}) ===\n")
        roles_data = _collect_rights_for_target(graph, target, depth)
    else:
        lines.append("=== Все права конфигурации ===\n")
        roles_data = _collect_all_rights(graph)

    if not roles_data:
        lines.append("  (права не найдены)")
        return "\n".join(lines)

    count = 0
    for role_name, obj_rights_list in roles_data.items():
        if count >= offset + limit:
            break

        lines.append(f"\n  Роль: {role_name}")
        lines.append(f"  {'=' * (len(role_name) + 6)}")

        role = graph.roles.get(role_name)
        if role and role.rls_templates:
            lines.append(f"  Шаблоны RLS: {len(role.rls_templates)}")

        for obj_r in obj_rights_list:
            count += 1
            if count <= offset:
                continue
            if count > offset + limit:
                break

            lines.append(f"\n    Объект: {obj_r.object_name}")

            for r in obj_r.rights:
                value_str = "Да" if r.value else "Нет"
                rls_str = ""
                if r.has_rls:
                    rls_str = f" [RLS: {r.rls_condition[:80]}...]" if len(r.rls_condition) > 80 else f" [RLS: {r.rls_condition}]"
                lines.append(f"      {r.right_name}: {value_str}{rls_str}")

    lines.append(f"\n--- Всего ролей: {len(roles_data)} ---")

    return "\n".join(lines)


def format_rights_json(graph: DependencyGraph, target: Optional[str] = None,
                       depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование прав в JSON."""
    if target:
        roles_data = _collect_rights_for_target(graph, target, depth)
    else:
        roles_data = _collect_all_rights(graph)

    result = {
        "mode": "rights",
        "target": target,
        "depth": depth,
        "total_roles": len(roles_data),
        "offset": offset,
        "limit": limit,
        "roles": {},
    }

    count = 0
    for role_name, obj_rights_list in roles_data.items():
        role_data = {
            "name": role_name,
            "objects": [],
        }

        role = graph.roles.get(role_name)
        if role:
            role_data["set_for_new_objects"] = role.set_for_new_objects
            role_data["independent_rights"] = role.independent_rights
            if role.rls_templates:
                role_data["rls_templates"] = [
                    {"name": t.name, "condition": t.condition}
                    for t in role.rls_templates
                ]

        for obj_r in obj_rights_list:
            count += 1
            if count <= offset:
                continue
            if count > offset + limit:
                break

            obj_data = {
                "object_name": obj_r.object_name,
                "rights": [
                    {
                        "right_name": r.right_name,
                        "value": r.value,
                        "has_rls": r.has_rls,
                        "rls_condition": r.rls_condition,
                    }
                    for r in obj_r.rights
                ],
            }
            role_data["objects"].append(obj_data)

        result["roles"][role_name] = role_data

    return json.dumps(result, ensure_ascii=False, indent=2)


def format_rights_md(graph: DependencyGraph, target: Optional[str] = None,
                     depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование прав в Markdown."""
    lines: List[str] = []

    if target:
        obj = graph.objects.get(target)
        label = _format_object_label(obj) if obj else target
        lines.append(f"# Права на объект: {label}\n")
        lines.append(f"**Глубина обхода:** {depth}\n")
        roles_data = _collect_rights_for_target(graph, target, depth)
    else:
        lines.append("# Аудит прав конфигурации\n")
        roles_data = _collect_all_rights(graph)

    if not roles_data:
        lines.append("*Права не найдены.*")
        return "\n".join(lines)

    lines.append(f"**Ролей:** {len(roles_data)}\n")

    count = 0
    for role_name, obj_rights_list in roles_data.items():
        if count >= offset + limit:
            break

        lines.append(f"\n## Роль: {role_name}\n")

        role = graph.roles.get(role_name)
        if role:
            props = []
            if role.set_for_new_objects:
                props.append("Устанавливается для новых объектов")
            if role.independent_rights:
                props.append("Независимые права подчинённых объектов")
            if props:
                lines.append("**Свойства:** " + "; ".join(props) + "\n")

            if role.rls_templates:
                lines.append("### Шаблоны RLS\n")
                for tmpl in role.rls_templates:
                    lines.append(f"- **{tmpl.name}**")
                    if tmpl.condition:
                        lines.append(f"  ```\n  {tmpl.condition}\n  ```")
                lines.append("")

        lines.append("| Объект | Право | Значение | RLS |")
        lines.append("|--------|-------|----------|-----|")

        for obj_r in obj_rights_list:
            count += 1
            if count <= offset:
                continue
            if count > offset + limit:
                break

            for r in obj_r.rights:
                value_str = "+" if r.value else "-"
                rls_str = ""
                if r.has_rls:
                    rls_short = r.rls_condition[:60] + "..." if len(r.rls_condition) > 60 else r.rls_condition
                    rls_str = f"`{rls_short}`"
                else:
                    rls_str = "—"

                lines.append(f"| `{obj_r.object_name}` | {r.right_name} | {value_str} | {rls_str} |")

    lines.append(f"\n*Показано ролей: {min(len(roles_data), limit)}*")

    return "\n".join(lines)


def _collect_rights_for_target(graph: DependencyGraph, target: str,
                               depth: int) -> Dict[str, List[ObjectRights]]:
    """Собрать права для target и связанных объектов."""
    relevant_objects = {target}

    if depth > 1:
        traversed = graph.traverse(target, depth, "both")
        for edge, level in traversed:
            relevant_objects.add(edge.source)
            relevant_objects.add(edge.target)

    result: Dict[str, List[ObjectRights]] = {}

    for role_name, role_info in graph.roles.items():
        matching_rights = []
        for obj_r in role_info.object_rights:
            if obj_r.object_name in relevant_objects:
                matching_rights.append(obj_r)
            else:
                for rel_obj in relevant_objects:
                    if obj_r.object_name.startswith(rel_obj) or rel_obj.startswith(obj_r.object_name):
                        matching_rights.append(obj_r)
                        break

        if matching_rights:
            result[role_name] = matching_rights

    return result


def _collect_all_rights(graph: DependencyGraph) -> Dict[str, List[ObjectRights]]:
    """Собрать все права конфигурации."""
    result: Dict[str, List[ObjectRights]] = {}
    for role_name, role_info in graph.roles.items():
        if role_info.object_rights:
            result[role_name] = role_info.object_rights
    return result


def _format_object_label(obj: ObjectInfo) -> str:
    type_ru = get_type_ru(obj.obj_type)
    label = f"{type_ru} \"{obj.name}\""
    if obj.synonym:
        label += f" ({obj.synonym})"
    return label
