"""Вывод: режим debug (text/json/md) — точки остановки для отладки."""

import json
from typing import Dict, List, Optional

from models import DependencyGraph, DebugPoint, ObjectInfo
from bsl_analyzer import get_debug_points, get_all_debug_points
from xml_helpers import get_type_ru


def format_debug_text(graph: DependencyGraph, target: Optional[str] = None,
                      depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование точек отладки в текстовый формат."""
    lines: List[str] = []
    points = _collect_debug_points(graph, target, depth)

    if target:
        lines.append(f"=== Точки отладки: {target} (глубина: {depth}) ===\n")
    else:
        lines.append("=== Все точки отладки конфигурации ===\n")

    if not points:
        lines.append("  (точки отладки не найдены)")
        return "\n".join(lines)

    for i, point in enumerate(points[offset:offset + limit], offset + 1):
        status = "[OK]" if point.exists else "[??]"
        ctx = f" — {point.context}" if point.context else ""
        line_info = f":{point.line_number}" if point.line_number > 0 else ""

        lines.append(
            f"  {i}. {status} {point.source_type}.{point.source_object} / "
            f"{point.procedure_name}()"
        )
        lines.append(
            f"     Файл: {point.module_path}{line_info}{ctx}"
        )

    lines.append(f"\n--- Всего точек: {len(points)} (показано: {min(limit, len(points) - offset)}) ---")

    return "\n".join(lines)


def format_debug_json(graph: DependencyGraph, target: Optional[str] = None,
                      depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование точек отладки в JSON."""
    points = _collect_debug_points(graph, target, depth)

    data = {
        "mode": "debug",
        "target": target,
        "depth": depth,
        "total_points": len(points),
        "offset": offset,
        "limit": limit,
        "points": [_point_to_dict(p) for p in points[offset:offset + limit]],
    }

    return json.dumps(data, ensure_ascii=False, indent=2)


def format_debug_md(graph: DependencyGraph, target: Optional[str] = None,
                    depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Форматирование точек отладки в Markdown."""
    lines: List[str] = []
    points = _collect_debug_points(graph, target, depth)

    if target:
        obj = graph.objects.get(target)
        label = _format_object_label(obj) if obj else target
        lines.append(f"# Точки отладки: {label}\n")
        lines.append(f"**Глубина обхода:** {depth}\n")
    else:
        lines.append("# Точки отладки конфигурации\n")

    if not points:
        lines.append("*Точки отладки не найдены.*")
        return "\n".join(lines)

    lines.append(f"**Всего точек:** {len(points)}\n")

    by_object: Dict[str, List[DebugPoint]] = {}
    for p in points[offset:offset + limit]:
        key = f"{p.source_type}.{p.source_object}"
        by_object.setdefault(key, []).append(p)

    for obj_key in sorted(by_object.keys()):
        obj_points = by_object[obj_key]
        obj = graph.objects.get(obj_key)
        obj_label = _format_object_label(obj) if obj else obj_key

        lines.append(f"\n## {obj_label}\n")
        lines.append("| # | Процедура | Файл | Строка | Контекст | Статус |")
        lines.append("|---|-----------|------|--------|----------|--------|")

        for i, p in enumerate(obj_points, 1):
            status = "OK" if p.exists else "??"
            line = str(p.line_number) if p.line_number > 0 else "—"
            ctx = p.context or "—"
            lines.append(
                f"| {i} | `{p.procedure_name}()` | `{p.module_path}` | {line} | {ctx} | {status} |"
            )

    lines.append(f"\n*Показано {min(limit, len(points) - offset)} из {len(points)} точек*")

    return "\n".join(lines)


def _collect_debug_points(graph: DependencyGraph, target: Optional[str],
                          depth: int) -> List[DebugPoint]:
    """Собрать точки отладки для target или всей конфигурации."""
    if target:
        obj = graph.objects.get(target)
        if not obj:
            return []

        points = get_debug_points(obj)

        if depth > 1:
            traversed = graph.traverse(target, depth, "both")
            visited = {target}
            for edge, level in traversed:
                for node in (edge.source, edge.target):
                    if node not in visited and node in graph.objects:
                        visited.add(node)
                        related_obj = graph.objects[node]
                        points.extend(get_debug_points(related_obj))

        return points
    else:
        return get_all_debug_points(graph.objects)


def _point_to_dict(point: DebugPoint) -> Dict:
    """Преобразовать DebugPoint в словарь для JSON."""
    return {
        "procedure_name": point.procedure_name,
        "module_path": point.module_path,
        "line_number": point.line_number,
        "context": point.context,
        "exists": point.exists,
        "source_object": point.source_object,
        "source_type": point.source_type,
    }


def _format_object_label(obj: ObjectInfo) -> str:
    type_ru = get_type_ru(obj.obj_type)
    label = f"{type_ru} \"{obj.name}\""
    if obj.synonym:
        label += f" ({obj.synonym})"
    return label
