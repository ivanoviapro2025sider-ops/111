"""Вывод: режим rights — аудит прав на объект (text/json/md)."""
import json
from typing import List, Dict

from models import DependencyGraph, RoleInfo, ObjectRights, RightInfo
from xml_helpers import get_type_ru, get_full_object_key
from parser_role import get_rights_for_object


def format_rights(graph: DependencyGraph, target: str,
                  out_format: str = "text", limit: int = 150,
                  offset: int = 0) -> str:
    """Форматировать аудит прав для объекта.

    target: ключ объекта в графе
    out_format: 'text' | 'json' | 'md'
    """
    rights = get_rights_for_object(graph, target)

    if out_format == "json":
        return _format_json(graph, target, rights, limit, offset)
    elif out_format == "md":
        return _format_md(graph, target, rights, limit, offset)
    else:
        return _format_text(graph, target, rights, limit, offset)


def _format_text(graph: DependencyGraph, target: str,
                 rights: List[dict], limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append(f"=== Аудит прав: {label} ===")
    lines.append("")

    if not rights:
        lines.append("Права не найдены.")
        lines.append("Возможные причины:")
        lines.append("  - В конфигурации нет ролей")
        lines.append("  - Объект не упомянут ни в одной роли")
        return "\n".join(lines)

    by_role = _group_by_role(rights)

    displayed = 0
    for role_name, role_rights in sorted(by_role.items()):
        if displayed >= offset + limit:
            break

        lines.append(f"Роль: {role_name}")
        for r in role_rights:
            if displayed < offset:
                displayed += 1
                continue
            if displayed >= offset + limit:
                break

            val_str = "Разрешено" if r["value"] else "Запрещено"
            rls_str = ""
            if r["has_rls"]:
                rls_str = f" [RLS: {r['rls'][:80]}{'...' if len(r.get('rls', '')) > 80 else ''}]"

            lines.append(f"  {r['right']}: {val_str}{rls_str}")
            displayed += 1

        lines.append("")

    lines.append(f"Всего записей прав: {len(rights)}")
    rls_count = sum(1 for r in rights if r["has_rls"])
    if rls_count:
        lines.append(f"Из них с RLS: {rls_count}")

    return "\n".join(lines)


def _format_json(graph: DependencyGraph, target: str,
                 rights: List[dict], limit: int, offset: int) -> str:
    obj = graph.objects.get(target)
    result = {
        "target": target,
        "type": obj.obj_type if obj else "",
        "name": obj.name if obj else "",
        "total_rights": len(rights),
        "rls_count": sum(1 for r in rights if r["has_rls"]),
        "roles": {},
    }

    by_role = _group_by_role(rights)
    displayed = 0
    for role_name, role_rights in sorted(by_role.items()):
        role_data = []
        for r in role_rights:
            if displayed < offset:
                displayed += 1
                continue
            if displayed >= offset + limit:
                break
            role_data.append({
                "right": r["right"],
                "value": r["value"],
                "has_rls": r["has_rls"],
                "rls": r["rls"] if r["has_rls"] else "",
            })
            displayed += 1
        if role_data:
            result["roles"][role_name] = role_data

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_md(graph: DependencyGraph, target: str,
               rights: List[dict], limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append(f"# Аудит прав: {label}")
    lines.append("")
    lines.append(f"**Всего записей прав:** {len(rights)}")
    rls_count = sum(1 for r in rights if r["has_rls"])
    if rls_count:
        lines.append(f"**С ограничениями RLS:** {rls_count}")
    lines.append("")

    if not rights:
        lines.append("_Права не найдены._")
        return "\n".join(lines)

    by_role = _group_by_role(rights)

    for role_name, role_rights in sorted(by_role.items()):
        lines.append(f"## Роль: {role_name}")
        lines.append("")
        lines.append("| Право | Значение | RLS |")
        lines.append("|-------|----------|-----|")

        for r in role_rights:
            val_str = "Да" if r["value"] else "Нет"
            rls_str = ""
            if r["has_rls"]:
                rls_short = r["rls"][:60] + ("..." if len(r.get("rls", "")) > 60 else "")
                rls_str = f"`{rls_short}`"
            lines.append(f"| {r['right']} | {val_str} | {rls_str} |")

        lines.append("")

    return "\n".join(lines)


def _group_by_role(rights: List[dict]) -> Dict[str, List[dict]]:
    """Сгруппировать права по ролям."""
    result: Dict[str, List[dict]] = {}
    for r in rights:
        role = r["role"]
        if role not in result:
            result[role] = []
        result[role].append(r)
    return result
