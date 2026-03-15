"""Вывод: режим rights (text/json/md)."""

from __future__ import annotations

import json
from typing import List

from models import DependencyGraph


def _flatten_rights(graph: DependencyGraph, target: str = "") -> List[dict]:
    """Развернуть роли → объекты → права в плоский список строк."""
    target_lc = target.lower() if target else ""
    result: List[dict] = []

    for role_name, role in graph.roles.items():
        if target and target_lc not in role_name.lower():
            # Разрешаем фильтр и по объектам прав
            if not any(target_lc in obj_right.object_name.lower() for obj_right in role.object_rights):
                continue

        for obj_right in role.object_rights:
            for right in obj_right.rights:
                result.append(
                    {
                        "role": role_name,
                        "object": obj_right.object_name,
                        "right_name": right.right_name,
                        "value": right.value,
                        "has_rls": right.has_rls,
                        "rls_condition": right.rls_condition,
                    }
                )

        # RLS-шаблоны как отдельные строки
        for template in role.rls_templates:
            result.append(
                {
                    "role": role_name,
                    "object": "<RLS.Template>",
                    "right_name": template.name,
                    "value": True,
                    "has_rls": True,
                    "rls_condition": template.condition,
                }
            )
    return result


def render_rights(
    graph: DependencyGraph,
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Отрендерить вывод режима rights в указанном формате."""
    items = _flatten_rights(graph, target=target)
    paged = items[offset : (offset + limit) if limit > 0 else None]

    if out_format == "json":
        return json.dumps(
            {
                "mode": "rights",
                "target": target,
                "total": len(items),
                "count": len(paged),
                "items": paged,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        lines = [
            "# Dependency Analyzer: rights",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Total rows: `{len(items)}`",
            "",
            "| Role | Object | Right | Value | RLS | Condition |",
            "|---|---|---|---|---|---|",
        ]
        for item in paged:
            lines.append(
                f"| `{item['role']}` | `{item['object']}` | `{item['right_name']}` | "
                f"`{item['value']}` | `{item['has_rls']}` | `{item['rls_condition']}` |"
            )
        return "\n".join(lines)

    # text format
    lines = [
        f"Mode: rights",
        f"Target: {target or 'ALL'}",
        f"Total rows: {len(items)}",
        "",
    ]
    for item in paged:
        lines.append(
            f"{item['role']} | {item['object']} | {item['right_name']}={item['value']} "
            f"| RLS={item['has_rls']} {item['rls_condition']}"
        )
    return "\n".join(lines)
