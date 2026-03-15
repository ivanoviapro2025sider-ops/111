"""Вывод: режим debug (text/json/md) — точки остановки для отладки."""

import json
from typing import List

from models import DebugPoint, DependencyGraph
from xml_helpers import get_type_ru


def format_debug(
    graph: DependencyGraph,
    target: str,
    debug_points: List[DebugPoint],
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Форматировать точки остановки для отладки."""
    if out_format == "json":
        return _format_debug_json(graph, target, debug_points, limit, offset)
    elif out_format == "md":
        return _format_debug_md(graph, target, debug_points, limit, offset)
    else:
        return _format_debug_text(graph, target, debug_points, limit, offset)


def _format_debug_text(
    graph: DependencyGraph,
    target: str,
    debug_points: List[DebugPoint],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"=== Точки отладки: {obj_type_ru} «{obj_name}» ({target}) ===")
    lines.append("")

    total = len(debug_points)
    sliced = debug_points[offset:offset + limit]

    if not sliced:
        lines.append("  (точки отладки не найдены)")
    else:
        for i, dp in enumerate(sliced, start=offset + 1):
            status = "[OK]" if dp.exists else "[?]"
            line_info = f"строка {dp.line_number}" if dp.line_number > 0 else "строка не определена"

            lines.append(f"  {i}. {status} {dp.procedure_name}")
            lines.append(f"     Модуль: {dp.module_path or '(не найден)'}")
            lines.append(f"     Строка: {line_info}")
            if dp.context:
                lines.append(f"     Контекст: {dp.context}")
            if dp.source_object:
                src_type_ru = get_type_ru(dp.source_type) if dp.source_type else ""
                lines.append(f"     Источник: {src_type_ru} «{dp.source_object}»")
            lines.append("")

    lines.append(f"Всего: {total} точек (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)


def _format_debug_json(
    graph: DependencyGraph,
    target: str,
    debug_points: List[DebugPoint],
    limit: int,
    offset: int,
) -> str:
    total = len(debug_points)
    sliced = debug_points[offset:offset + limit]

    obj = graph.objects.get(target)
    result = {
        "target": target,
        "target_name": obj.name if obj else target,
        "target_type": obj.obj_type if obj else "",
        "total": total,
        "offset": offset,
        "limit": limit,
        "debug_points": [],
    }

    for dp in sliced:
        result["debug_points"].append({
            "procedure_name": dp.procedure_name,
            "module_path": dp.module_path,
            "line_number": dp.line_number,
            "context": dp.context,
            "exists": dp.exists,
            "source_object": dp.source_object,
            "source_type": dp.source_type,
        })

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_debug_md(
    graph: DependencyGraph,
    target: str,
    debug_points: List[DebugPoint],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"# Точки отладки: {obj_type_ru} «{obj_name}»")
    lines.append("")

    total = len(debug_points)
    sliced = debug_points[offset:offset + limit]

    if not sliced:
        lines.append("_Точки отладки не найдены._")
    else:
        lines.append("| # | Статус | Процедура | Модуль | Строка | Контекст |")
        lines.append("|---|--------|-----------|--------|--------|----------|")

        for i, dp in enumerate(sliced, start=offset + 1):
            status = "OK" if dp.exists else "?"
            line_info = str(dp.line_number) if dp.line_number > 0 else "—"
            module = dp.module_path or "—"
            context = dp.context or "—"

            lines.append(
                f"| {i} | {status} | `{dp.procedure_name}` | `{module}` | {line_info} | {context} |"
            )

    lines.append("")
    lines.append(f"**Всего:** {total} точек (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)
