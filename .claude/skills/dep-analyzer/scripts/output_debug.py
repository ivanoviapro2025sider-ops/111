"""Вывод: режим debug — точки остановки и отладочная информация (text/json/md)."""

import json
from typing import List, Dict

from models import DependencyGraph, DebugPoint, ObjectInfo
from xml_helpers import get_type_ru, split_object_key
from graph_builder import find_objects_by_pattern
from bsl_analyzer import get_debug_points


def format_debug(graph: DependencyGraph, target: str, depth: int,
                 out_format: str = "text", limit: int = 150, offset: int = 0,
                 config_path: str = "") -> str:
    """Format debug output for one or more objects."""
    targets = find_objects_by_pattern(graph, target)
    if not targets:
        return _no_results(target, out_format)

    if out_format == "json":
        return _format_debug_json(graph, targets, depth, limit, offset, config_path)
    elif out_format == "md":
        return _format_debug_md(graph, targets, depth, limit, offset, config_path)
    else:
        return _format_debug_text(graph, targets, depth, limit, offset, config_path)


def _format_debug_text(graph: DependencyGraph, targets: List[str], depth: int,
                       limit: int, offset: int, config_path: str) -> str:
    lines = []
    total_points = 0

    for target in targets:
        obj = graph.objects.get(target)
        if not obj:
            continue

        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj.synonym else ""

        lines.append(f"{'='*60}")
        lines.append(f"DEBUG: {type_ru}: {obj_name}{synonym}")
        lines.append(f"{'='*60}")

        points = get_debug_points(obj, graph, config_path)

        if depth > 1:
            points.extend(_get_related_debug_points(graph, target, depth, config_path))

        shown = 0
        for pt in points[offset:]:
            if shown >= limit:
                break

            exists_mark = "✓" if pt.exists else "?"
            line_info = f"строка {pt.line_number}" if pt.line_number > 0 else "строка неизвестна"
            context_info = f" — {pt.context}" if pt.context else ""

            lines.append(f"  [{exists_mark}] {pt.procedure_name} ({line_info})")
            lines.append(f"      Модуль: {pt.module_path}{context_info}")

            if pt.source_object and pt.source_type:
                lines.append(f"      Источник: {pt.source_type}.{pt.source_object}")

            shown += 1
            total_points += 1

        if not points:
            lines.append("  Точки остановки не найдены.")

        lines.append("")

    header = f"Найдено точек остановки: {total_points}\n"
    return header + "\n".join(lines)


def _format_debug_json(graph: DependencyGraph, targets: List[str], depth: int,
                       limit: int, offset: int, config_path: str) -> str:
    result = {
        "total_targets": len(targets),
        "depth": depth,
        "results": [],
    }

    for target in targets:
        obj = graph.objects.get(target)
        if not obj:
            continue

        obj_type, obj_name = split_object_key(target)
        entry = {
            "object": target,
            "type": obj_type,
            "name": obj_name,
            "synonym": obj.synonym,
            "debug_points": [],
        }

        points = get_debug_points(obj, graph, config_path)
        if depth > 1:
            points.extend(_get_related_debug_points(graph, target, depth, config_path))

        for pt in points[offset:offset + limit]:
            entry["debug_points"].append({
                "procedure": pt.procedure_name,
                "module": pt.module_path,
                "line": pt.line_number,
                "context": pt.context,
                "exists": pt.exists,
                "source_object": pt.source_object,
                "source_type": pt.source_type,
            })

        entry["total_points"] = len(points)
        result["results"].append(entry)

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_debug_md(graph: DependencyGraph, targets: List[str], depth: int,
                     limit: int, offset: int, config_path: str) -> str:
    lines = []

    for target in targets:
        obj = graph.objects.get(target)
        if not obj:
            continue

        obj_type, obj_name = split_object_key(target)
        type_ru = get_type_ru(obj_type)
        synonym = f" ({obj.synonym})" if obj.synonym else ""

        lines.append(f"## Отладка: {type_ru}: {obj_name}{synonym}")
        lines.append("")

        points = get_debug_points(obj, graph, config_path)
        if depth > 1:
            points.extend(_get_related_debug_points(graph, target, depth, config_path))

        if not points:
            lines.append("_Точки остановки не найдены._")
            lines.append("")
            continue

        lines.append("| Статус | Процедура | Модуль | Строка | Контекст |")
        lines.append("|--------|-----------|--------|--------|----------|")

        shown = 0
        for pt in points[offset:]:
            if shown >= limit:
                break

            status = "✓" if pt.exists else "?"
            line_str = str(pt.line_number) if pt.line_number > 0 else "—"
            context = pt.context or "—"

            lines.append(f"| {status} | `{pt.procedure_name}` | `{pt.module_path}` | {line_str} | {context} |")
            shown += 1

        if shown < len(points):
            lines.append(f"\n> Показано {shown} из {len(points)} точек")

        lines.append("")

    return "\n".join(lines)


def _get_related_debug_points(graph: DependencyGraph, target: str,
                              depth: int, config_path: str) -> List[DebugPoint]:
    """Get debug points from related objects (depth > 1)."""
    points = []
    visited = {target}
    traversal = graph.traverse(target, depth, direction="both")

    for edge, level in traversal:
        related = edge.target if edge.source == target else edge.source
        if related in visited:
            continue
        visited.add(related)

        obj = graph.objects.get(related)
        if obj:
            related_points = get_debug_points(obj, graph, config_path)
            for pt in related_points:
                pt.context = f"[Связанный: {related}] {pt.context}"
            points.extend(related_points)

    return points


def _no_results(target: str, out_format: str) -> str:
    if out_format == "json":
        return json.dumps({"error": f"Object not found: {target}", "results": []},
                          ensure_ascii=False, indent=2)
    elif out_format == "md":
        return f"## Ошибка\n\nОбъект не найден: `{target}`"
    else:
        return f"[ERROR] Объект не найден: {target}"
