"""Output formatter for debug mode."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DebugPoint, DependencyGraph, ObjectInfo

_DOC_PROCEDURE_HINTS = {
    "обработкапроведения",
    "posting",
    "beforewrite",
    "beforepost",
    "onwrite",
    "приЗаписи".lower(),
}


def _build_proc_index(graph: DependencyGraph) -> Dict[str, Dict[str, int]]:
    index: Dict[str, Dict[str, int]] = {}
    for key, obj in graph.objects.items():
        methods = {proc.name.lower(): proc.line_number for proc in obj.procedures}
        if methods:
            index[key] = methods
    return index


def _pick_document_points(obj_key: str, obj: ObjectInfo) -> List[DebugPoint]:
    points: List[DebugPoint] = []
    for proc in obj.procedures:
        proc_name_l = proc.name.lower()
        if any(hint in proc_name_l for hint in _DOC_PROCEDURE_HINTS):
            points.append(
                DebugPoint(
                    procedure_name=proc.name,
                    module_path=proc.module_path,
                    line_number=proc.line_number,
                    context="Проведение документа",
                    exists=True,
                    source_object=obj.name,
                    source_type=obj.obj_type,
                )
            )
    return points


def _pick_subscription_points(graph: DependencyGraph) -> List[DebugPoint]:
    points: List[DebugPoint] = []
    proc_index = _build_proc_index(graph)

    for sub_key, obj in graph.objects.items():
        if obj.obj_type != "EventSubscription" or not obj.handler:
            continue

        module_name, _, method_name = obj.handler.partition(".")
        module_key = f"CommonModule.{module_name}"
        line = 0
        exists = False
        if module_key in proc_index and method_name:
            line = proc_index[module_key].get(method_name.lower(), 0)
            exists = bool(line)
        elif module_key in graph.objects:
            exists = True

        module_path = ""
        module_obj = graph.objects.get(module_key)
        if module_obj and module_obj.procedures:
            module_path = module_obj.procedures[0].module_path

        points.append(
            DebugPoint(
                procedure_name=obj.handler,
                module_path=module_path,
                line_number=line,
                context=f"Подписка на событие ({obj.event})" if obj.event else "Подписка на событие",
                exists=exists,
                source_object=obj.name,
                source_type=obj.obj_type,
            )
        )
    return points


def collect_debug_points(graph: DependencyGraph, target: str = "") -> List[DebugPoint]:
    """Collect debug points from documents, subscriptions and parsed procedures."""
    points: List[DebugPoint] = []
    for key, obj in graph.objects.items():
        if target and key != target:
            continue
        if obj.obj_type == "Document":
            points.extend(_pick_document_points(key, obj))
        elif obj.obj_type in {"Catalog", "Report", "DataProcessor"} and obj.procedures:
            # Фоллбэк: первая процедура модуля как точка входа для отладки
            first = sorted(obj.procedures, key=lambda p: p.line_number)[0]
            points.append(
                DebugPoint(
                    procedure_name=first.name,
                    module_path=first.module_path,
                    line_number=first.line_number,
                    context=f"Точка входа модуля {obj.obj_type}",
                    exists=True,
                    source_object=obj.name,
                    source_type=obj.obj_type,
                )
            )

    if not target:
        points.extend(_pick_subscription_points(graph))
    else:
        obj = graph.objects.get(target)
        if obj and obj.obj_type == "EventSubscription":
            points.extend(_pick_subscription_points(graph))

    # de-dup
    uniq: List[DebugPoint] = []
    seen = set()
    for point in points:
        sig = (point.procedure_name, point.module_path, point.line_number, point.source_object)
        if sig in seen:
            continue
        seen.add(sig)
        uniq.append(point)
    return uniq


def format_debug(
    graph: DependencyGraph,
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Render debug points output."""
    points = collect_debug_points(graph, target=target)
    total = len(points)
    if offset < 0:
        offset = 0
    page = points[offset : offset + limit] if limit > 0 else points[offset:]

    payload = {
        "mode": "debug",
        "target": target,
        "total": total,
        "count": len(page),
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "procedure_name": p.procedure_name,
                "module_path": p.module_path,
                "line_number": p.line_number,
                "context": p.context,
                "exists": p.exists,
                "source_object": p.source_object,
                "source_type": p.source_type,
            }
            for p in page
        ],
    }

    fmt = out_format.lower()
    if fmt == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if fmt in {"md", "markdown"}:
        lines = [
            "# Debug Points",
            "",
            f"- Target: `{target or 'ALL'}`",
            f"- Total: `{total}`",
            f"- Showing: `{len(page)}` (offset={offset}, limit={limit})",
            "",
            "| Exists | Object | Procedure | Module | Line | Context |",
            "|---|---|---|---|---:|---|",
        ]
        for p in page:
            lines.append(
                f"| {'✅' if p.exists else '❌'} | `{p.source_type}.{p.source_object}` | `{p.procedure_name}` | "
                f"`{p.module_path}` | {p.line_number} | {p.context} |"
            )
        return "\n".join(lines)

    lines = [
        "Debug points",
        f"Target: {target or 'ALL'} | Total: {total} | Showing: {len(page)} | Offset: {offset} | Limit: {limit}",
        "",
    ]
    for p in page:
        marker = "OK" if p.exists else "MISSING"
        lines.append(
            f"[{marker}] {p.source_type}.{p.source_object}: {p.procedure_name} @ {p.module_path}:{p.line_number} | {p.context}"
        )
    return "\n".join(lines)
