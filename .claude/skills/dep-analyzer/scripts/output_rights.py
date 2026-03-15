"""Вывод: режим rights (text/json/md) — аудит прав на объект."""

import json
from typing import Dict, List

from models import DependencyGraph, RightInfo, RoleInfo
from xml_helpers import get_type_ru


def format_rights(
    graph: DependencyGraph,
    target: str,
    rights_by_role: Dict[str, List[RightInfo]],
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Форматировать результат аудита прав."""
    if out_format == "json":
        return _format_rights_json(graph, target, rights_by_role, limit, offset)
    elif out_format == "md":
        return _format_rights_md(graph, target, rights_by_role, limit, offset)
    else:
        return _format_rights_text(graph, target, rights_by_role, limit, offset)


def _format_rights_text(
    graph: DependencyGraph,
    target: str,
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"=== Права: {obj_type_ru} «{obj_name}» ({target}) ===")
    lines.append("")

    roles = list(rights_by_role.items())
    total = len(roles)
    sliced = roles[offset:offset + limit]

    if not sliced:
        lines.append("  (права не найдены)")
    else:
        for role_name, role_rights in sliced:
            role_info = graph.roles.get(role_name)
            synonym = role_info.synonym if role_info else ""
            display_name = f"{role_name}" + (f" ({synonym})" if synonym else "")

            lines.append(f"  Роль: {display_name}")

            granted = [r for r in role_rights if r.value]
            denied = [r for r in role_rights if not r.value]
            rls_rights = [r for r in role_rights if r.has_rls]

            if granted:
                rights_str = ", ".join(r.right_name for r in granted)
                lines.append(f"    Разрешено: {rights_str}")

            if denied:
                rights_str = ", ".join(r.right_name for r in denied)
                lines.append(f"    Запрещено: {rights_str}")

            if rls_rights:
                lines.append("    RLS:")
                for r in rls_rights:
                    cond = r.rls_condition[:100] + "..." if len(r.rls_condition) > 100 else r.rls_condition
                    lines.append(f"      {r.right_name}: {cond}")

            lines.append("")

    lines.append(f"Всего: {total} ролей (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)


def _format_rights_json(
    graph: DependencyGraph,
    target: str,
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    roles = list(rights_by_role.items())
    total = len(roles)
    sliced = roles[offset:offset + limit]

    obj = graph.objects.get(target)
    result = {
        "target": target,
        "target_name": obj.name if obj else target,
        "target_type": obj.obj_type if obj else "",
        "total": total,
        "offset": offset,
        "limit": limit,
        "roles": [],
    }

    for role_name, role_rights in sliced:
        role_info = graph.roles.get(role_name)
        role_data = {
            "name": role_name,
            "synonym": role_info.synonym if role_info else "",
            "rights": [],
        }

        for r in role_rights:
            right_data = {
                "right_name": r.right_name,
                "value": r.value,
                "has_rls": r.has_rls,
            }
            if r.has_rls:
                right_data["rls_condition"] = r.rls_condition
            role_data["rights"].append(right_data)

        result["roles"].append(role_data)

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_rights_md(
    graph: DependencyGraph,
    target: str,
    rights_by_role: Dict[str, List[RightInfo]],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"# Права: {obj_type_ru} «{obj_name}»")
    lines.append("")

    roles = list(rights_by_role.items())
    total = len(roles)
    sliced = roles[offset:offset + limit]

    if not sliced:
        lines.append("_Права не найдены._")
    else:
        lines.append("| Роль | Право | Значение | RLS |")
        lines.append("|------|-------|----------|-----|")

        for role_name, role_rights in sliced:
            role_info = graph.roles.get(role_name)
            synonym = role_info.synonym if role_info else ""
            display_name = f"{role_name}" + (f" ({synonym})" if synonym else "")

            for r in role_rights:
                value_str = "Да" if r.value else "Нет"
                rls_str = "Да" if r.has_rls else "—"
                lines.append(
                    f"| {display_name} | {r.right_name} | {value_str} | {rls_str} |"
                )
                display_name = ""

        if any(r.has_rls for _, rights in sliced for r in rights):
            lines.append("")
            lines.append("## Условия RLS")
            lines.append("")
            for role_name, role_rights in sliced:
                rls_rights = [r for r in role_rights if r.has_rls]
                if rls_rights:
                    lines.append(f"### Роль: {role_name}")
                    lines.append("")
                    for r in rls_rights:
                        lines.append(f"**{r.right_name}:**")
                        lines.append("```")
                        lines.append(r.rls_condition)
                        lines.append("```")
                        lines.append("")

    lines.append("")
    lines.append(f"**Всего:** {total} ролей (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)
