"""Output rendering for rights mode."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DependencyGraph, RoleInfo


def _role_to_dict(role: RoleInfo) -> Dict[str, object]:
    return {
        "name": role.name,
        "synonym": role.synonym,
        "set_for_new_objects": role.set_for_new_objects,
        "set_for_attributes_by_default": role.set_for_attributes_by_default,
        "independent_rights": role.independent_rights,
        "object_rights": [
            {
                "object_name": rights.object_name,
                "rights": [
                    {
                        "right_name": right.right_name,
                        "value": right.value,
                        "has_rls": right.has_rls,
                        "rls_condition": right.rls_condition,
                    }
                    for right in rights.rights
                ],
            }
            for rights in role.object_rights
        ],
        "rls_templates": [{"name": template.name, "condition": template.condition} for template in role.rls_templates],
    }


def build_rights_payload(
    graph: DependencyGraph,
    target: str = "",
    limit: int = 150,
    offset: int = 0,
) -> Dict[str, object]:
    roles: List[RoleInfo] = sorted(graph.roles.values(), key=lambda item: item.name.lower())
    if target:
        target_lc = target.lower()
        roles = [role for role in roles if target_lc in role.name.lower()]

    total = len(roles)
    sliced = roles[offset : offset + limit] if limit >= 0 else roles[offset:]

    return {
        "mode": "rights",
        "target": target,
        "total_roles": total,
        "returned_roles": len(sliced),
        "offset": offset,
        "limit": limit,
        "roles": [_role_to_dict(role) for role in sliced],
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [
        f"Mode: {payload['mode']}",
        f"Target: {payload['target'] or '<all roles>'}",
        f"Roles: {payload['returned_roles']}/{payload['total_roles']}",
        "",
    ]

    for role in payload["roles"]:
        lines.append(f"[Role] {role['name']}")
        if role.get("synonym"):
            lines.append(f"  Synonym: {role['synonym']}")
        if role["rls_templates"]:
            lines.append(f"  RLS templates: {len(role['rls_templates'])}")
        lines.append(f"  Object rights: {len(role['object_rights'])}")
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [
        "# Rights Audit",
        "",
        f"- **Target:** `{payload['target'] or '<all roles>'}`",
        f"- **Roles:** `{payload['returned_roles']}/{payload['total_roles']}`",
        "",
        "| Role | Object rights | RLS templates |",
        "|---|---:|---:|",
    ]
    for role in payload["roles"]:
        lines.append(
            f"| `{role['name']}` | {len(role['object_rights'])} | {len(role['rls_templates'])} |"
        )
    return "\n".join(lines)


def render_rights(
    graph: DependencyGraph,
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    payload = build_rights_payload(graph, target=target, limit=limit, offset=offset)
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
