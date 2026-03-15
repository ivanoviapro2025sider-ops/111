"""Formatting for rights output."""

from __future__ import annotations

import json
from typing import List, Optional

from models import DependencyGraph, ObjectRights, RoleInfo


def _right_to_dict(role_name: str, object_right: ObjectRights) -> dict:
    return {
        "role": role_name,
        "object_name": object_right.object_name,
        "rights": [
            {
                "right_name": right.right_name,
                "value": right.value,
                "has_rls": right.has_rls,
                "rls_condition": right.rls_condition,
            }
            for right in object_right.rights
        ],
    }


def build_rights_payload(
    graph: DependencyGraph,
    *,
    target: Optional[str] = None,
    limit: int = 150,
    offset: int = 0,
) -> dict:
    """Build rights audit payload."""

    items: List[dict] = []

    if target and target in graph.roles:
        role = graph.roles[target]
        for object_right in role.object_rights:
            items.append(_right_to_dict(role.name, object_right))
    elif target:
        for role in graph.roles.values():
            for object_right in role.object_rights:
                if object_right.object_name == target or object_right.object_name.startswith(target + "."):
                    items.append(_right_to_dict(role.name, object_right))
    else:
        for role in graph.roles.values():
            for object_right in role.object_rights:
                items.append(_right_to_dict(role.name, object_right))

    paged_items = items[offset : offset + limit] if limit > 0 else items[offset:]
    rls_count = sum(
        1
        for item in items
        for right in item["rights"]
        if right["has_rls"] or right["rls_condition"]
    )

    return {
        "mode": "rights",
        "target": target or "",
        "summary": {
            "roles": len(graph.roles),
            "rights_entries": len(items),
            "returned_entries": len(paged_items),
            "rls_entries": rls_count,
            "limit": limit,
            "offset": offset,
        },
        "rights": paged_items,
    }


def render_rights(payload: dict, out_format: str = "text") -> str:
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        lines = [
            "# Rights audit",
            "",
            f"- Target: `{payload['target'] or 'ALL'}`",
            f"- Roles: `{payload['summary']['roles']}`",
            f"- Rights entries: `{payload['summary']['rights_entries']}`",
            f"- RLS entries: `{payload['summary']['rls_entries']}`",
            "",
            "| Role | Object | Rights |",
            "| --- | --- | --- |",
        ]
        for item in payload["rights"]:
            rights_text = ", ".join(
                f"{right['right_name']}={'yes' if right['value'] else 'no'}"
                + (" [RLS]" if right["has_rls"] or right["rls_condition"] else "")
                for right in item["rights"]
            )
            lines.append(f"| `{item['role']}` | `{item['object_name']}` | {rights_text} |")
        return "\n".join(lines)

    lines = [
        "Rights audit",
        f"Target: {payload['target'] or 'ALL'}",
        f"Roles: {payload['summary']['roles']}",
        f"Rights entries: {payload['summary']['rights_entries']}",
        f"RLS entries: {payload['summary']['rls_entries']}",
        "",
    ]
    for item in payload["rights"]:
        rights_text = ", ".join(
            f"{right['right_name']}={'yes' if right['value'] else 'no'}"
            + (f" [RLS: {right['rls_condition']}]" if right["has_rls"] or right["rls_condition"] else "")
            for right in item["rights"]
        )
        lines.append(f"- {item['role']} -> {item['object_name']}: {rights_text}")
    return "\n".join(lines)
