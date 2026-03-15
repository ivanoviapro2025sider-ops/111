"""Форматированный вывод аудита прав: text/json/md."""

from __future__ import annotations

import json
from typing import Dict, List

from graph_builder import resolve_target_key
from models import DependencyGraph, ObjectRights, RightInfo, RoleInfo


def _serialize_right(right: RightInfo) -> Dict[str, object]:
    return {
        "right_name": right.right_name,
        "value": right.value,
        "has_rls": right.has_rls,
        "rls_condition": right.rls_condition,
    }


def _serialize_object_rights(object_rights: ObjectRights) -> Dict[str, object]:
    return {
        "object_name": object_rights.object_name,
        "rights": [_serialize_right(right) for right in object_rights.rights],
    }


def _serialize_role(role_info: RoleInfo) -> Dict[str, object]:
    return {
        "name": role_info.name,
        "synonym": role_info.synonym,
        "set_for_new_objects": role_info.set_for_new_objects,
        "set_for_attributes_by_default": role_info.set_for_attributes_by_default,
        "independent_rights": role_info.independent_rights,
        "object_rights": [_serialize_object_rights(item) for item in role_info.object_rights],
        "rls_templates": [{"name": tpl.name, "condition": tpl.condition} for tpl in role_info.rls_templates],
    }


def _filter_roles(graph: DependencyGraph, target: str) -> List[RoleInfo]:
    if not target:
        return list(graph.roles.values())

    direct_name = graph.roles.get(target)
    if direct_name:
        return [direct_name]

    normalized = target.lower()
    for role_info in graph.roles.values():
        if role_info.name.lower() == normalized:
            return [role_info]

    resolved_object = resolve_target_key(graph, target) or target
    result = []
    for role_info in graph.roles.values():
        matching = [
            object_rights
            for object_rights in role_info.object_rights
            if object_rights.object_name == resolved_object or object_rights.object_name.startswith(f"{resolved_object}.")
        ]
        if matching:
            result.append(
                RoleInfo(
                    name=role_info.name,
                    synonym=role_info.synonym,
                    set_for_new_objects=role_info.set_for_new_objects,
                    set_for_attributes_by_default=role_info.set_for_attributes_by_default,
                    independent_rights=role_info.independent_rights,
                    object_rights=matching,
                    rls_templates=role_info.rls_templates,
                )
            )
    return result


def render_rights(graph: DependencyGraph, target: str = "", out_format: str = "text") -> str:
    """Сформировать отчёт по ролям, правам и RLS."""

    roles = _filter_roles(graph, target)
    payload = {
        "mode": "rights",
        "target": target or None,
        "role_count": len(roles),
        "roles": [_serialize_role(role_info) for role_info in roles],
    }

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Rights audit",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Roles: `{len(roles)}`",
            "",
        ]
        for role_info in roles:
            lines.extend(
                [
                    f"## {role_info.name}",
                    "",
                    f"- Synonym: {role_info.synonym or '-'}",
                    f"- setForNewObjects: `{str(role_info.set_for_new_objects).lower()}`",
                    f"- setForAttributesByDefault: `{str(role_info.set_for_attributes_by_default).lower()}`",
                    f"- independentRights: `{str(role_info.independent_rights).lower()}`",
                    "",
                    "| Object | Rights | RLS |",
                    "| --- | --- | --- |",
                ]
            )
            for object_rights in role_info.object_rights:
                rights_text = ", ".join(
                    f"{right.right_name}{' [DENY]' if not right.value else ''}"
                    for right in object_rights.rights
                )
                rls_text = "; ".join(right.rls_condition for right in object_rights.rights if right.has_rls and right.rls_condition) or "-"
                lines.append(f"| `{object_rights.object_name}` | {rights_text} | {rls_text} |")
            if role_info.rls_templates:
                lines.extend(["", "Templates:", ""])
                for template in role_info.rls_templates:
                    lines.append(f"- `{template.name}`: {template.condition or '-'}")
            lines.append("")
        return "\n".join(lines)

    lines = [
        "=== Rights audit ===",
        f"Target: {target or 'ALL'}",
        f"Roles: {len(roles)}",
        "",
    ]
    for role_info in roles:
        lines.append(f"Role: {role_info.name}{f' ({role_info.synonym})' if role_info.synonym else ''}")
        lines.append(
            "  Properties: "
            f"setForNewObjects={str(role_info.set_for_new_objects).lower()}, "
            f"setForAttributesByDefault={str(role_info.set_for_attributes_by_default).lower()}, "
            f"independentRights={str(role_info.independent_rights).lower()}"
        )
        for object_rights in role_info.object_rights:
            rights_bits = []
            for right in object_rights.rights:
                label = right.right_name if right.value else f"-{right.right_name}"
                if right.has_rls:
                    label += " [RLS]"
                rights_bits.append(label)
            lines.append(f"  - {object_rights.object_name}: {', '.join(rights_bits)}")
        if role_info.rls_templates:
            lines.append("  Templates:")
            for template in role_info.rls_templates:
                lines.append(f"    - {template.name}: {template.condition or '-'}")
        lines.append("")
    return "\n".join(lines)
