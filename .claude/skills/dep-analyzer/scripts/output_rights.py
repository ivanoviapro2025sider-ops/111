"""Вывод: режим rights — аудит прав и RLS (text/json/md)."""

import json
from typing import List, Dict, Optional

from models import DependencyGraph, RoleInfo, ObjectRights, RightInfo, RLSTemplate
from xml_helpers import get_type_ru, split_object_key
from graph_builder import find_objects_by_pattern


def format_rights(graph: DependencyGraph, target: str, depth: int,
                  out_format: str = "text", limit: int = 150, offset: int = 0) -> str:
    """Format rights audit output."""
    targets = find_objects_by_pattern(graph, target)
    if not targets:
        return _no_results(target, out_format)

    if out_format == "json":
        return _format_rights_json(graph, targets, depth, limit, offset)
    elif out_format == "md":
        return _format_rights_md(graph, targets, depth, limit, offset)
    else:
        return _format_rights_text(graph, targets, depth, limit, offset)


def _collect_rights_for_object(graph: DependencyGraph, obj_key: str) -> List[Dict]:
    """Collect rights from all roles for a given object."""
    results = []

    for role_name, role_info in graph.roles.items():
        for obj_rights in role_info.object_rights:
            if _object_matches(obj_rights.object_name, obj_key):
                for right in obj_rights.rights:
                    results.append({
                        "role": role_name,
                        "role_synonym": role_info.synonym,
                        "object": obj_rights.object_name,
                        "right": right.right_name,
                        "value": right.value,
                        "has_rls": right.has_rls,
                        "rls_condition": right.rls_condition,
                    })

    return results


def _object_matches(rights_object_name: str, target_key: str) -> bool:
    """Check if a rights object name matches the target."""
    if rights_object_name == target_key:
        return True

    if "." in target_key:
        obj_type, obj_name = split_object_key(target_key)
        if rights_object_name.endswith(f".{obj_name}"):
            return True
        if rights_object_name == f"{obj_type}.{obj_name}":
            return True
        if rights_object_name.startswith(target_key + "."):
            return True

    return False


def _format_rights_text(graph: DependencyGraph, targets: List[str], depth: int,
                        limit: int, offset: int) -> str:
    lines = []
    total_rights = 0

    for target in targets:
        obj = graph.objects.get(target)
        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj and obj.synonym else ""

        lines.append(f"{'='*60}")
        lines.append(f"ПРАВА: {type_ru}: {obj_name}{synonym}")
        lines.append(f"{'='*60}")

        rights = _collect_rights_for_object(graph, target)

        if depth > 1:
            related_keys = _get_related_objects(graph, target, depth)
            for rel_key in related_keys:
                rel_rights = _collect_rights_for_object(graph, rel_key)
                for rr in rel_rights:
                    rr["_related"] = rel_key
                rights.extend(rel_rights)

        shown = 0
        for ri in rights[offset:]:
            if shown >= limit:
                break

            role_label = ri["role"]
            if ri.get("role_synonym"):
                role_label += f" ({ri['role_synonym']})"

            value_str = "✓ Разрешено" if ri["value"] else "✗ Запрещено"
            rls_str = ""
            if ri["has_rls"]:
                rls_str = f"\n      RLS: {ri['rls_condition'][:100]}"

            related = f" [от: {ri['_related']}]" if ri.get("_related") else ""

            lines.append(f"  Роль: {role_label}")
            lines.append(f"    {ri['right']}: {value_str}{related}{rls_str}")
            shown += 1
            total_rights += 1

        if not rights:
            lines.append("  Права не назначены ни в одной роли.")

        lines.append("")

    header = f"Найдено записей о правах: {total_rights}\n"
    return header + "\n".join(lines)


def _format_rights_json(graph: DependencyGraph, targets: List[str], depth: int,
                        limit: int, offset: int) -> str:
    result = {
        "total_targets": len(targets),
        "depth": depth,
        "results": [],
    }

    for target in targets:
        obj = graph.objects.get(target)
        obj_type, obj_name = split_object_key(target)

        entry = {
            "object": target,
            "type": obj_type,
            "name": obj_name,
            "synonym": obj.synonym if obj else "",
            "rights": [],
        }

        rights = _collect_rights_for_object(graph, target)

        if depth > 1:
            related_keys = _get_related_objects(graph, target, depth)
            for rel_key in related_keys:
                rel_rights = _collect_rights_for_object(graph, rel_key)
                for rr in rel_rights:
                    rr["related_object"] = rel_key
                rights.extend(rel_rights)

        for ri in rights[offset:offset + limit]:
            entry["rights"].append({
                "role": ri["role"],
                "role_synonym": ri.get("role_synonym", ""),
                "object": ri["object"],
                "right_name": ri["right"],
                "value": ri["value"],
                "has_rls": ri["has_rls"],
                "rls_condition": ri["rls_condition"],
                "related_object": ri.get("related_object", ri.get("_related", "")),
            })

        entry["total_rights"] = len(rights)
        result["results"].append(entry)

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_rights_md(graph: DependencyGraph, targets: List[str], depth: int,
                      limit: int, offset: int) -> str:
    lines = []

    for target in targets:
        obj = graph.objects.get(target)
        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj and obj.synonym else ""

        lines.append(f"## Права: {type_ru}: {obj_name}{synonym}")
        lines.append("")

        rights = _collect_rights_for_object(graph, target)

        if depth > 1:
            related_keys = _get_related_objects(graph, target, depth)
            for rel_key in related_keys:
                rel_rights = _collect_rights_for_object(graph, rel_key)
                for rr in rel_rights:
                    rr["_related"] = rel_key
                rights.extend(rel_rights)

        if not rights:
            lines.append("_Права не назначены ни в одной роли._")
            lines.append("")
            continue

        lines.append("| Роль | Право | Значение | RLS | Объект |")
        lines.append("|------|-------|----------|-----|--------|")

        shown = 0
        for ri in rights[offset:]:
            if shown >= limit:
                break

            role_label = ri["role"]
            if ri.get("role_synonym"):
                role_label = f"{ri['role']} ({ri['role_synonym']})"

            value_str = "✓" if ri["value"] else "✗"
            rls_str = "Да" if ri["has_rls"] else "—"
            obj_str = ri.get("_related", ri.get("object", ""))

            lines.append(f"| {role_label} | {ri['right']} | {value_str} | {rls_str} | {obj_str} |")
            shown += 1

        if ri.get("has_rls"):
            lines.append("")
            lines.append("### RLS-условия")
            lines.append("")
            for ri in rights:
                if ri["has_rls"] and ri["rls_condition"]:
                    lines.append(f"**{ri['role']}** → {ri['right']}:")
                    lines.append(f"```")
                    lines.append(ri["rls_condition"])
                    lines.append(f"```")
                    lines.append("")

        rls_templates = _collect_rls_templates(graph, targets)
        if rls_templates:
            lines.append("")
            lines.append("### Шаблоны ограничений")
            lines.append("")
            for tpl in rls_templates:
                lines.append(f"**{tpl['role']}** → `{tpl['name']}`:")
                lines.append(f"```")
                lines.append(tpl["condition"])
                lines.append(f"```")
                lines.append("")

        if shown < len(rights):
            lines.append(f"\n> Показано {shown} из {len(rights)} записей")

        lines.append("")

    return "\n".join(lines)


def _get_related_objects(graph: DependencyGraph, target: str, depth: int) -> List[str]:
    """Get related object keys up to given depth."""
    result = []
    traversal = graph.traverse(target, depth, direction="both")
    seen = {target}
    for edge, level in traversal:
        for node in (edge.source, edge.target):
            if node not in seen:
                seen.add(node)
                result.append(node)
    return result


def _collect_rls_templates(graph: DependencyGraph, targets: List[str]) -> List[Dict]:
    """Collect RLS templates relevant to target objects."""
    templates = []
    for role_name, role_info in graph.roles.items():
        if role_info.rls_templates:
            for tpl in role_info.rls_templates:
                for target in targets:
                    if target.lower() in tpl.condition.lower() or not targets:
                        templates.append({
                            "role": role_name,
                            "name": tpl.name,
                            "condition": tpl.condition,
                        })
                        break
    return templates


def _no_results(target: str, out_format: str) -> str:
    if out_format == "json":
        return json.dumps({"error": f"Object not found: {target}", "results": []},
                          ensure_ascii=False, indent=2)
    elif out_format == "md":
        return f"## Ошибка\n\nОбъект не найден: `{target}`"
    else:
        return f"[ERROR] Объект не найден: {target}"
