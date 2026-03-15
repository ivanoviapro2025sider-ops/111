"""Output formatter for rights mode."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DependencyGraph, RoleInfo


def _load_roles(graph: DependencyGraph) -> Dict[str, RoleInfo]:
    if graph.roles:
        return graph.roles
    roles: Dict[str, RoleInfo] = {}
    for obj in graph.objects.values():
        if obj.obj_type == "Role" and obj.role_info:
            roles[obj.role_info.name] = obj.role_info
    return roles


def _role_to_dict(role: RoleInfo, object_filter: str = "") -> Dict[str, object]:
    object_rights = role.object_rights
    if object_filter:
        object_rights = [item for item in object_rights if object_filter in item.object_name]
    return {
        "name": role.name,
        "synonym": role.synonym,
        "set_for_new_objects": role.set_for_new_objects,
        "set_for_attributes_by_default": role.set_for_attributes_by_default,
        "independent_rights": role.independent_rights,
        "rls_templates": [{"name": tpl.name, "condition": tpl.condition} for tpl in role.rls_templates],
        "object_rights": [
            {
                "object_name": item.object_name,
                "rights": [
                    {
                        "right_name": right.right_name,
                        "value": right.value,
                        "has_rls": right.has_rls,
                        "rls_condition": right.rls_condition,
                    }
                    for right in item.rights
                ],
            }
            for item in object_rights
        ],
    }


def format_rights(
    graph: DependencyGraph,
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Render rights audit report."""
    roles = _load_roles(graph)

    role_filter = ""
    object_filter = ""
    if target:
        if target.startswith("Role."):
            role_filter = target.split(".", 1)[1]
        elif "." in target:
            object_filter = target
        else:
            role_filter = target

    role_items = sorted(roles.values(), key=lambda r: r.name)
    if role_filter:
        role_items = [role for role in role_items if role_filter.lower() in role.name.lower()]

    total = len(role_items)
    if offset < 0:
        offset = 0
    page = role_items[offset : offset + limit] if limit > 0 else role_items[offset:]
    role_dicts = [_role_to_dict(role, object_filter=object_filter) for role in page]

    payload = {
        "mode": "rights",
        "target": target,
        "total": total,
        "count": len(role_dicts),
        "offset": offset,
        "limit": limit,
        "items": role_dicts,
    }

    fmt = out_format.lower()
    if fmt == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if fmt in {"md", "markdown"}:
        lines = [
            "# Rights Audit",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Roles total: `{total}`",
            f"- Showing: `{len(role_dicts)}` (offset={offset}, limit={limit})",
            "",
        ]
        for role in role_dicts:
            lines.append(f"## Role `{role['name']}`")
            if role["synonym"]:
                lines.append(f"- Synonym: {role['synonym']}")
            lines.append(
                f"- Flags: new_objects={role['set_for_new_objects']}, "
                f"attributes_by_default={role['set_for_attributes_by_default']}, "
                f"independent={role['independent_rights']}"
            )
            if role["rls_templates"]:
                lines.append("- RLS templates:")
                for tpl in role["rls_templates"]:
                    lines.append(f"  - `{tpl['name']}`: `{tpl['condition']}`")
            lines.append("")
            lines.append("| Object | Right | Value | RLS |")
            lines.append("|---|---|---|---|")
            for obj_rights in role["object_rights"]:
                for right in obj_rights["rights"]:
                    lines.append(
                        f"| `{obj_rights['object_name']}` | `{right['right_name']}` | "
                        f"`{right['value']}` | `{right['rls_condition'] if right['has_rls'] else ''}` |"
                    )
            lines.append("")
        return "\n".join(lines)

    lines = [
        "Rights audit",
        f"Target: {target or 'ALL'} | Roles total: {total} | Showing: {len(role_dicts)} | Offset: {offset} | Limit: {limit}",
        "",
    ]
    for role in role_dicts:
        lines.append(f"Role: {role['name']} ({role['synonym']})")
        lines.append(
            f"  Flags: new_objects={role['set_for_new_objects']}, "
            f"attributes_by_default={role['set_for_attributes_by_default']}, independent={role['independent_rights']}"
        )
        if role["rls_templates"]:
            lines.append("  RLS templates:")
            for tpl in role["rls_templates"]:
                lines.append(f"    - {tpl['name']}: {tpl['condition']}")
        for obj_rights in role["object_rights"]:
            lines.append(f"  Object: {obj_rights['object_name']}")
            for right in obj_rights["rights"]:
                rls = f" | RLS: {right['rls_condition']}" if right["has_rls"] else ""
                lines.append(f"    - {right['right_name']}={right['value']}{rls}")
        lines.append("")
    return "\n".join(lines)
