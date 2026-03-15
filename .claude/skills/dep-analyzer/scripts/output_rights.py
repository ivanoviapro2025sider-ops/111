"""Output formatting for rights mode."""

from __future__ import annotations

import json
from typing import Dict, Iterable, List

from models import RoleInfo


def build_rights_payload(roles: Iterable[RoleInfo], *, target: str, limit: int, offset: int) -> Dict:
    rows: List[Dict] = []
    for role in roles:
        if target and role.name != target:
            # If target is metadata object, keep only matching object rights.
            matching_object_rights = [obj_rights for obj_rights in role.object_rights if obj_rights.object_name == target]
            if not matching_object_rights:
                continue
            object_rights_list = matching_object_rights
        else:
            object_rights_list = role.object_rights

        for object_rights in object_rights_list:
            for right in object_rights.rights:
                rows.append(
                    {
                        "role": role.name,
                        "object_name": object_rights.object_name,
                        "right_name": right.right_name,
                        "value": right.value,
                        "has_rls": right.has_rls,
                        "rls_condition": right.rls_condition,
                    }
                )

    return {
        "mode": "rights",
        "target": target,
        "total_items": len(rows),
        "limit": limit,
        "offset": offset,
        "items": rows[offset : offset + limit],
    }


def _render_text(payload: Dict) -> str:
    lines = [
        "Rights analysis",
        f"Target: {payload.get('target') or '<all>'}",
        f"Total rights: {payload.get('total_items')}",
        "",
    ]
    for row in payload.get("items", []):
        rls = f" RLS=({row['rls_condition']})" if row["has_rls"] else ""
        lines.append(
            f"{row['role']}: {row['object_name']} -> {row['right_name']}={row['value']}{rls}"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict) -> str:
    lines = [
        "# Rights analysis",
        "",
        f"- **Target:** `{payload.get('target') or '<all>'}`",
        f"- **Total rights:** `{payload.get('total_items')}`",
        "",
        "| Role | Object | Right | Value | RLS | Condition |",
        "|---|---|---|---|---|---|",
    ]
    for row in payload.get("items", []):
        rls_mark = "✅" if row["has_rls"] else ""
        lines.append(
            f"| `{row['role']}` | `{row['object_name']}` | `{row['right_name']}` | "
            f"`{row['value']}` | {rls_mark} | {row['rls_condition']} |"
        )
    return "\n".join(lines)


def render_rights(payload: Dict, out_format: str = "text") -> str:
    out_format = (out_format or "text").lower()
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
