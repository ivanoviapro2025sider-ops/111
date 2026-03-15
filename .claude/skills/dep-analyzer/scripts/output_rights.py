"""Output formatter for rights mode."""

from __future__ import annotations

import json
from typing import Dict, List, Tuple

from models import DependencyGraph, RoleInfo


def _paginate(items: List[dict], limit: int, offset: int) -> Tuple[List[dict], int]:
    total = len(items)
    if limit <= 0:
        return items[offset:], total
    return items[offset : offset + limit], total


def _matches_target(role: RoleInfo, target: str) -> bool:
    if not target:
        return True
    lowered_target = target.lower()
    if lowered_target in role.name.lower() or lowered_target in role.synonym.lower():
        return True
    for object_rights in role.object_rights:
        if lowered_target in object_rights.object_name.lower():
            return True
    return False


def build_rights_payload(graph: DependencyGraph, target: str = "", limit: int = 150, offset: int = 0) -> Dict[str, object]:
    items: List[dict] = []
    for role_name in sorted(graph.roles):
        role = graph.roles[role_name]
        if not _matches_target(role, target):
            continue
        items.append(
            {
                "role_name": role.name,
                "synonym": role.synonym,
                "set_for_new_objects": role.set_for_new_objects,
                "set_for_attributes_by_default": role.set_for_attributes_by_default,
                "independent_rights": role.independent_rights,
                "rls_templates": [{"name": template.name, "condition": template.condition} for template in role.rls_templates],
                "object_rights": [
                    {
                        "object_name": object_rights.object_name,
                        "rights": [
                            {
                                "right_name": right.right_name,
                                "value": right.value,
                                "has_rls": right.has_rls,
                                "rls_condition": right.rls_condition,
                            }
                            for right in object_rights.rights
                        ],
                    }
                    for object_rights in role.object_rights
                ],
            }
        )

    page, total = _paginate(items, limit=limit, offset=offset)
    return {
        "mode": "rights",
        "target": target,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page,
    }


def render_rights(graph: DependencyGraph, out_format: str = "text", target: str = "", limit: int = 150, offset: int = 0) -> str:
    payload = build_rights_payload(graph, target=target, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        lines = [
            "# Rights Audit",
            "",
            f"- Filter: `{payload['target'] or 'all roles'}`",
            f"- Total roles: `{payload['total']}`",
            "",
        ]
        for item in payload["items"]:
            lines.extend(
                [
                    f"## {item['role_name']}",
                    "",
                    f"- Synonym: {item['synonym'] or '-'}",
                    f"- Set for new objects: `{item['set_for_new_objects']}`",
                    f"- Set for attributes by default: `{item['set_for_attributes_by_default']}`",
                    f"- Independent rights: `{item['independent_rights']}`",
                    "",
                ]
            )
            if item["rls_templates"]:
                lines.append("### RLS templates")
                for template in item["rls_templates"]:
                    lines.append(f"- `{template['name']}`: {template['condition'] or '-'}")
                lines.append("")
            if item["object_rights"]:
                lines.append("| Object | Right | Value | RLS | Condition |")
                lines.append("| --- | --- | --- | --- | --- |")
                for object_rights in item["object_rights"]:
                    for right in object_rights["rights"]:
                        lines.append(
                            f"| `{object_rights['object_name']}` | `{right['right_name']}` | `{right['value']}` | `{right['has_rls']}` | {right['rls_condition'] or '-'} |"
                        )
                lines.append("")
        return "\n".join(lines)

    lines = [
        "Mode: rights",
        f"Filter: {payload['target'] or 'all roles'}",
        f"Total roles: {payload['total']}",
        "",
    ]
    for item in payload["items"]:
        lines.append(f"Role: {item['role_name']} ({item['synonym'] or '-'})")
        lines.append(
            f"  defaults: new_objects={item['set_for_new_objects']}, attributes_by_default={item['set_for_attributes_by_default']}, independent_rights={item['independent_rights']}"
        )
        for template in item["rls_templates"]:
            lines.append(f"  RLS template: {template['name']} => {template['condition'] or '-'}")
        for object_rights in item["object_rights"]:
            for right in object_rights["rights"]:
                suffix = f", rls={right['rls_condition']}" if right["has_rls"] else ""
                lines.append(
                    f"  {object_rights['object_name']}: {right['right_name']}={right['value']}{suffix}"
                )
        lines.append("")
    if not payload["items"]:
        lines.append("No rights entries found.")
    return "\n".join(lines)
