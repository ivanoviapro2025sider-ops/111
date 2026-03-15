"""Вывод: режим debug — точки остановки для отладки (text/json/md)."""
import json
from typing import List, Dict

from models import DependencyGraph, DebugPoint
from xml_helpers import get_type_ru, get_full_object_key
from bsl_analyzer import get_debug_points


def format_debug(graph: DependencyGraph, target: str, config_path: str,
                 out_format: str = "text", limit: int = 150,
                 offset: int = 0) -> str:
    """Форматировать точки отладки для объекта.

    target: ключ объекта в графе
    config_path: корень конфигурации
    out_format: 'text' | 'json' | 'md'
    """
    points = get_debug_points(graph, target, config_path)

    if out_format == "json":
        return _format_json(graph, target, points, limit, offset)
    elif out_format == "md":
        return _format_md(graph, target, points, limit, offset)
    else:
        return _format_text(graph, target, points, limit, offset)


def _format_text(graph: DependencyGraph, target: str,
                 points: List[DebugPoint], limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append(f"=== Точки отладки: {label} ===")
    lines.append("")

    if not points:
        lines.append("Точки отладки не найдены.")
        lines.append("Возможные причины:")
        lines.append("  - BSL-модули не найдены в каталоге объекта")
        lines.append("  - Объект не содержит процедур/функций")
        return "\n".join(lines)

    displayed = 0
    for i, pt in enumerate(points):
        if displayed < offset:
            displayed += 1
            continue
        if displayed >= offset + limit:
            break

        status = "[OK]" if pt.exists else "[?]"
        line_info = f"строка {pt.line_number}" if pt.line_number > 0 else "строка не определена"

        lines.append(f"{status} {pt.procedure_name}")
        lines.append(f"     Модуль: {pt.module_path}")
        lines.append(f"     Строка: {line_info}")
        lines.append(f"     Контекст: {pt.context}")
        if pt.source_object and pt.source_type:
            lines.append(f"     Источник: {pt.source_type}.{pt.source_object}")
        lines.append("")
        displayed += 1

    lines.append(f"Всего точек: {len(points)}")
    return "\n".join(lines)


def _format_json(graph: DependencyGraph, target: str,
                 points: List[DebugPoint], limit: int, offset: int) -> str:
    obj = graph.objects.get(target)
    result = {
        "target": target,
        "type": obj.obj_type if obj else "",
        "name": obj.name if obj else "",
        "total_points": len(points),
        "points": [],
    }

    displayed = 0
    for pt in points:
        if displayed < offset:
            displayed += 1
            continue
        if displayed >= offset + limit:
            break

        result["points"].append({
            "procedure": pt.procedure_name,
            "module": pt.module_path,
            "line": pt.line_number,
            "context": pt.context,
            "exists": pt.exists,
            "source_object": pt.source_object,
            "source_type": pt.source_type,
        })
        displayed += 1

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_md(graph: DependencyGraph, target: str,
               points: List[DebugPoint], limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append(f"# Точки отладки: {label}")
    lines.append("")
    lines.append(f"**Всего точек:** {len(points)}")
    lines.append("")

    if not points:
        lines.append("_Точки отладки не найдены._")
        return "\n".join(lines)

    lines.append("| # | Статус | Процедура | Модуль | Строка | Контекст |")
    lines.append("|---|--------|-----------|--------|--------|----------|")

    displayed = 0
    idx = 0
    for pt in points:
        idx += 1
        if displayed < offset:
            displayed += 1
            continue
        if displayed >= offset + limit:
            break

        status = "OK" if pt.exists else "?"
        line_str = str(pt.line_number) if pt.line_number > 0 else "-"
        lines.append(
            f"| {idx} | {status} | `{pt.procedure_name}` | "
            f"`{pt.module_path}` | {line_str} | {pt.context} |"
        )
        displayed += 1

    return "\n".join(lines)
