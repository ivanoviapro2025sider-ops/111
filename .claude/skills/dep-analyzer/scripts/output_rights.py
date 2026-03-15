"""Rights and RLS output renderers."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DependencyGraph, RoleInfo


def build_rights_payload(graph: DependencyGraph, target: str = "") -> Dict[str, object]:
    roles: List[RoleInfo] = []
    object_filter = ""

    if target:
        if target in graph.roles:
            roles = [graph.roles[target]]
        else:
            role_key = f"Role.{target}"
            if role_key in graph.objects and graph.objects[role_key].role_info is not None:
                roles = [graph.objects[role_key].role_info]
            else:
                object_filter = target
                roles = list(graph.roles.values())
    else:
        roles = list(graph.roles.values())

    serialized_roles = []
    for role in roles:
        object_rights = role.object_rights
        if object_filter:
            object_rights = [item for item in object_rights if item.object_name == object_filter or item.object_name.endswith(f".{object_filter}")]
        serialized_roles.append(
            {
                "name": role.name,
                "synonym": role.synonym,
                "set_for_new_objects": role.set_for_new_objects,
                "set_for_attributes_by_default": role.set_for_attributes_by_default,
                "independent_rights": role.independent_rights,
                "rls_templates": [{"name": tpl.name, "condition": tpl.condition} for tpl in role.rls_templates],
                "object_rights": [
                    {
                        "object_name": obj_rights.object_name,
                        "rights": [
                            {
                                "right_name": right.right_name,
                                "value": right.value,
                                "has_rls": right.has_rls,
                                "rls_condition": right.rls_condition,
                            }
                            for right in obj_rights.rights
                        ],
                    }
                    for obj_rights in object_rights
                ],
            }
        )

    return {
        "mode": "rights",
        "target": target,
        "roles": serialized_roles,
        "total_roles": len(serialized_roles),
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [f"=== Rights audit: {payload.get('target') or 'all roles'} ===", ""]
    if not payload["roles"]:
        lines.append("No roles or rights found.")
        return "\n".join(lines)

    for role in payload["roles"]:
        lines.append(f"Role: {role['name']}" + (f' ("{role["synonym"]}")' if role["synonym"] else ""))
        lines.append(
            f"  Flags: new={role['set_for_new_objects']}, attrsByDefault={role['set_for_attributes_by_default']}, independent={role['independent_rights']}"
        )
        if role["rls_templates"]:
            lines.append("  RLS templates:")
            for template in role["rls_templates"]:
                lines.append(f"    - {template['name']}: {template['condition']}")
        if role["object_rights"]:
            lines.append("  Object rights:")
            for object_rights in role["object_rights"]:
                parts = []
                for right in object_rights["rights"]:
                    status = "allow" if right["value"] else "deny"
                    suffix = " [RLS]" if right["has_rls"] else ""
                    if right["rls_condition"]:
                        suffix += f" ({right['rls_condition']})"
                    parts.append(f"{status}:{right['right_name']}{suffix}")
                lines.append(f"    - {object_rights['object_name']}: {', '.join(parts)}")
        lines.append("")
    return "\n".join(lines).rstrip()


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [f"# Rights audit: {payload.get('target') or 'all roles'}", ""]
    if not payload["roles"]:
        lines.append("No roles or rights found.")
        return "\n".join(lines)
    for role in payload["roles"]:
        lines.extend(
            [
                f"## {role['name']}",
                "",
                f"- Synonym: {role['synonym'] or '-'}",
                f"- Set for new objects: `{role['set_for_new_objects']}`",
                f"- Set for attributes by default: `{role['set_for_attributes_by_default']}`",
                f"- Independent rights: `{role['independent_rights']}`",
                "",
            ]
        )
        if role["rls_templates"]:
            lines.append("### RLS templates")
            for template in role["rls_templates"]:
                lines.append(f"- `{template['name']}`: {template['condition']}")
            lines.append("")
        if role["object_rights"]:
            lines.extend(["### Object rights", "", "| Object | Rights |", "|---|---|"])
            for object_rights in role["object_rights"]:
                rights_text = ", ".join(
                    f"{'allow' if right['value'] else 'deny'}:{right['right_name']}"
                    + (" [RLS]" if right["has_rls"] else "")
                    + (f" ({right['rls_condition']})" if right["rls_condition"] else "")
                    for right in object_rights["rights"]
                )
                lines.append(f"| `{object_rights['object_name']}` | {rights_text} |")
            lines.append("")
    return "\n".join(lines).rstrip()


def render_rights(graph: DependencyGraph, target: str = "", out_format: str = "text") -> str:
    payload = build_rights_payload(graph, target)
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
