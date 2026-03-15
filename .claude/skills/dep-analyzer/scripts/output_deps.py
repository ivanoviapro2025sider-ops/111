"""Вывод: режим deps — зависимости объекта (text/json/md)."""

import json
from typing import List, Dict, Optional, Tuple

from models import DependencyGraph, Edge, EdgeKind, ObjectInfo
from xml_helpers import get_type_ru, split_object_key
from graph_builder import get_dependencies, get_dependency_tree, find_objects_by_pattern


def format_deps(graph: DependencyGraph, target: str, depth: int,
                out_format: str = "text", limit: int = 150, offset: int = 0) -> str:
    """Format dependency output for one or more objects."""
    targets = find_objects_by_pattern(graph, target)
    if not targets:
        return _no_results_message(target, out_format)

    if out_format == "json":
        return _format_deps_json(graph, targets, depth, limit, offset)
    elif out_format == "md":
        return _format_deps_md(graph, targets, depth, limit, offset)
    else:
        return _format_deps_text(graph, targets, depth, limit, offset)


def _format_deps_text(graph: DependencyGraph, targets: List[str], depth: int,
                      limit: int, offset: int) -> str:
    """Plain text format."""
    lines = []
    total = 0
    shown = 0

    for target in targets:
        obj = graph.objects.get(target)
        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj and obj.synonym else ""

        lines.append(f"{'='*60}")
        lines.append(f"{type_ru}: {obj_name}{synonym}")
        lines.append(f"{'='*60}")

        tree = get_dependency_tree(graph, target, depth, direction="both")
        flat = _flatten_tree(tree)

        for item in flat[offset:]:
            if shown >= limit:
                break
            total += 1

            indent = "  " * item["level"]
            edge_label = _edge_kind_label(item.get("edge_kind", ""))
            item_type, item_name = split_object_key(item["object"])
            item_type_ru = get_type_ru(item_type)

            info = item.get("info")
            synonym_str = f" ({info.synonym})" if info and info.synonym else ""

            direction = item.get("direction", "→")
            lines.append(f"{indent}{direction} [{edge_label}] {item_type_ru}.{item_name}{synonym_str}")
            shown += 1

        if shown < total:
            lines.append(f"\n... ещё {total - shown} зависимостей (используйте --offset)")

        lines.append("")

    header = f"Найдено объектов: {len(targets)}, зависимостей: {total}\n"
    return header + "\n".join(lines)


def _format_deps_json(graph: DependencyGraph, targets: List[str], depth: int,
                      limit: int, offset: int) -> str:
    """JSON format."""
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
            "dependencies": [],
        }

        tree = get_dependency_tree(graph, target, depth, direction="both")
        flat = _flatten_tree(tree)

        for item in flat[offset:offset + limit]:
            dep = {
                "object": item["object"],
                "edge_kind": item.get("edge_kind", ""),
                "level": item["level"],
            }
            info = item.get("info")
            if info:
                dep["synonym"] = info.synonym
                dep["type"] = info.obj_type
                dep["name"] = info.name
            entry["dependencies"].append(dep)

        entry["total_dependencies"] = len(flat)
        result["results"].append(entry)

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_deps_md(graph: DependencyGraph, targets: List[str], depth: int,
                    limit: int, offset: int) -> str:
    """Markdown format."""
    lines = []

    for target in targets:
        obj = graph.objects.get(target)
        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj and obj.synonym else ""

        lines.append(f"## {type_ru}: {obj_name}{synonym}")
        lines.append("")

        tree = get_dependency_tree(graph, target, depth, direction="both")
        flat = _flatten_tree(tree)
        shown = 0

        if not flat:
            lines.append("_Зависимости не найдены._")
            lines.append("")
            continue

        lines.append("| Уровень | Тип связи | Объект | Синоним |")
        lines.append("|---------|-----------|--------|--------|")

        for item in flat[offset:]:
            if shown >= limit:
                break

            edge_label = _edge_kind_label(item.get("edge_kind", ""))
            item_type, item_name = split_object_key(item["object"])
            item_type_ru = get_type_ru(item_type)
            info = item.get("info")
            synonym_str = info.synonym if info and info.synonym else ""

            lines.append(f"| {item['level']} | {edge_label} | {item_type_ru}.{item_name} | {synonym_str} |")
            shown += 1

        if shown < len(flat):
            lines.append(f"\n> Показано {shown} из {len(flat)} зависимостей")

        lines.append("")

    return "\n".join(lines)


def _flatten_tree(tree: Dict, direction: str = "→") -> List[Dict]:
    """Flatten a dependency tree into a list."""
    result = []
    for child in tree.get("children", []):
        item = {
            "object": child["object"],
            "edge_kind": child.get("edge_kind", ""),
            "level": child.get("level", 1),
            "info": child.get("info"),
            "direction": direction,
        }
        result.append(item)
        result.extend(_flatten_tree(child, direction))
    return result


def _edge_kind_label(kind: str) -> str:
    """Human-readable edge kind label."""
    labels = {
        "doc_to_register": "Движение",
        "doc_to_catalog": "Ссылка на справочник",
        "doc_to_document": "Ссылка на документ",
        "catalog_to_catalog": "Ссылка на справочник",
        "catalog_to_document": "Ссылка на документ",
        "register_to_document": "Регистратор",
        "register_to_catalog": "Ссылка на справочник",
        "register_to_register": "Ссылка на регистр",
        "subscription_to_object": "Подписка на событие",
        "subscription_to_module": "Обработчик подписки",
        "bsl_call": "Вызов модуля",
        "bsl_meta_access": "Обращение к метаданным",
        "bsl_query_ref": "Ссылка в запросе",
        "based_on": "Ввод на основании",
        "owner": "Владелец",
        "hierarchy": "Иерархия",
    }
    return labels.get(kind, kind)


def _no_results_message(target: str, out_format: str) -> str:
    if out_format == "json":
        return json.dumps({"error": f"Object not found: {target}", "results": []},
                          ensure_ascii=False, indent=2)
    elif out_format == "md":
        return f"## Ошибка\n\nОбъект не найден: `{target}`"
    else:
        return f"[ERROR] Объект не найден: {target}"
