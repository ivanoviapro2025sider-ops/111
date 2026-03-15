"""Вывод: режим debug (text/json/md)."""

from __future__ import annotations

import json
from typing import List

from models import DebugPoint, DependencyGraph


# Подсказки для имён процедур, связанных с отладкой
DEBUG_NAME_HINTS = (
    "обработкапроведения",
    "передзаписью",
    "призаписи",
    "припроведении",
    "onwrite",
    "onpost",
    "posting",
)


def collect_debug_points(graph: DependencyGraph, target: str = "") -> List[DebugPoint]:
    """Собрать точки остановки из процедур и подписок на события."""
    points: List[DebugPoint] = []
    target_lc = target.lower() if target else ""

    for key, obj in graph.objects.items():
        if target and target_lc not in key.lower():
            continue

        # Процедуры из BSL-модулей
        for proc in obj.procedures:
            name_lc = proc.name.lower()
            # Все процедуры документов + процедуры с «отладочными» именами
            if obj.obj_type == "Document" or any(hint in name_lc for hint in DEBUG_NAME_HINTS):
                points.append(
                    DebugPoint(
                        procedure_name=proc.name,
                        module_path=proc.module_path,
                        line_number=proc.line_number,
                        context="Проведение документа" if obj.obj_type == "Document" else "BSL процедура",
                        exists=True,
                        source_object=obj.name,
                        source_type=obj.obj_type,
                    )
                )

        # Обработчики подписок на события
        if obj.obj_type == "EventSubscription" and obj.handler:
            points.append(
                DebugPoint(
                    procedure_name=obj.handler.split(".")[-1],
                    module_path=obj.path,
                    line_number=0,
                    context=f"Подписка на событие: {obj.event}",
                    exists=True,
                    source_object=obj.name,
                    source_type=obj.obj_type,
                )
            )
    return points


def render_debug(
    graph: DependencyGraph,
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Отрендерить вывод режима debug в указанном формате."""
    points = collect_debug_points(graph=graph, target=target)
    paged = points[offset : (offset + limit) if limit > 0 else None]

    payload = [
        {
            "procedure_name": p.procedure_name,
            "module_path": p.module_path,
            "line_number": p.line_number,
            "context": p.context,
            "exists": p.exists,
            "source_object": p.source_object,
            "source_type": p.source_type,
        }
        for p in paged
    ]

    if out_format == "json":
        return json.dumps(
            {
                "mode": "debug",
                "target": target,
                "total": len(points),
                "count": len(payload),
                "items": payload,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        lines = [
            "# Dependency Analyzer: debug",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Total points: `{len(points)}`",
            "",
            "| Procedure | Module | Line | Context |",
            "|---|---|---:|---|",
        ]
        for item in payload:
            lines.append(
                f"| `{item['procedure_name']}` | `{item['module_path']}` "
                f"| {item['line_number']} | {item['context']} |"
            )
        return "\n".join(lines)

    # text format
    lines = [
        f"Mode: debug",
        f"Target: {target or 'ALL'}",
        f"Total points: {len(points)}",
        "",
    ]
    for item in payload:
        lines.append(
            f"{item['source_type']}.{item['source_object']}: {item['procedure_name']} "
            f"({item['module_path']}:{item['line_number']}) [{item['context']}]"
        )
    return "\n".join(lines)
