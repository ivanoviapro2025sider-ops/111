"""Debug breakpoint renderers."""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from graph_builder import resolve_target
from models import DebugPoint, DependencyGraph, ObjectInfo

_KNOWN_CONTEXTS = {
    "ОбработкаПроведения": "Проведение документа",
    "Posting": "Проведение документа",
    "ПередЗаписью": "Перед записью",
    "BeforeWrite": "Перед записью",
    "ПриЗаписи": "При записи",
    "OnWrite": "При записи",
    "ПередУдалением": "Перед удалением",
    "BeforeDelete": "Перед удалением",
    "ПриУдалении": "При удалении",
    "OnDelete": "При удалении",
    "ПередПроведением": "Перед проведением",
    "BeforePost": "Перед проведением",
}


def _resolve_object(objects: Dict[str, ObjectInfo], target: str) -> Optional[ObjectInfo]:
    if target in objects:
        return objects[target]
    matches = [obj for obj in objects.values() if obj.name == target]
    if len(matches) == 1:
        return matches[0]
    return None


def _debug_points_for_object(obj: ObjectInfo) -> List[DebugPoint]:
    points: List[DebugPoint] = []
    for procedure in obj.procedures:
        context = _KNOWN_CONTEXTS.get(procedure.name, "")
        if obj.obj_type == "Document":
            if not context:
                continue
        elif obj.obj_type == "CommonModule":
            if not procedure.is_export and not context:
                continue
            context = context or "Экспортная процедура общего модуля"
        else:
            context = context or "Процедура модуля"
        points.append(
            DebugPoint(
                procedure_name=procedure.name,
                module_path=procedure.module_path,
                line_number=procedure.line_number,
                context=context,
                exists=True,
                source_object=obj.name,
                source_type=obj.obj_type,
            )
        )
    if not points and obj.procedures:
        for procedure in obj.procedures:
            points.append(
                DebugPoint(
                    procedure_name=procedure.name,
                    module_path=procedure.module_path,
                    line_number=procedure.line_number,
                    context="Процедура модуля",
                    exists=True,
                    source_object=obj.name,
                    source_type=obj.obj_type,
                )
            )
    return points


def _subscription_debug_points(objects: Dict[str, ObjectInfo], target_obj: ObjectInfo) -> List[DebugPoint]:
    points: List[DebugPoint] = []
    for obj in objects.values():
        if obj.obj_type != "EventSubscription":
            continue
        if target_obj.key not in obj.source_types and obj.key != target_obj.key:
            continue
        if not obj.handler:
            continue
        module_name, _, method_name = obj.handler.partition(".")
        module_obj = _resolve_object(objects, f"CommonModule.{module_name}") or _resolve_object(objects, module_name)
        procedure = None
        if module_obj:
            for candidate in module_obj.procedures:
                if candidate.name == method_name:
                    procedure = candidate
                    break
        points.append(
            DebugPoint(
                procedure_name=method_name or obj.handler,
                module_path=procedure.module_path if procedure else (module_obj.procedures[0].module_path if module_obj and module_obj.procedures else ""),
                line_number=procedure.line_number if procedure else 0,
                context=f"Подписка на событие: {obj.event or 'handler'}",
                exists=procedure is not None,
                source_object=obj.name,
                source_type=obj.obj_type,
            )
        )
    return points


def build_debug_payload(graph: DependencyGraph, target: str) -> Dict[str, object]:
    target_key = resolve_target(graph, target) if target else None
    if target_key:
        selected = [graph.objects[target_key]]
    else:
        selected = list(graph.objects.values())

    points: List[DebugPoint] = []
    for obj in selected:
        points.extend(_debug_points_for_object(obj))
        points.extend(_subscription_debug_points(graph.objects, obj))

    deduped = []
    seen = set()
    for point in points:
        key = (
            point.procedure_name,
            point.module_path,
            point.line_number,
            point.context,
            point.source_object,
            point.source_type,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(point)

    return {
        "mode": "debug",
        "target": target_key or target,
        "total_points": len(deduped),
        "points": [
            {
                "procedure_name": point.procedure_name,
                "module_path": point.module_path,
                "line_number": point.line_number,
                "context": point.context,
                "exists": point.exists,
                "source_object": point.source_object,
                "source_type": point.source_type,
            }
            for point in deduped
        ],
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [f"=== Debug points: {payload.get('target') or 'all objects'} ===", ""]
    if not payload["points"]:
        lines.append("No debug points found.")
        return "\n".join(lines)
    for point in payload["points"]:
        status = "OK" if point["exists"] else "MISSING"
        location = f"{point['module_path']}:{point['line_number']}" if point["module_path"] else "(module not resolved)"
        lines.append(
            f"- [{status}] {point['procedure_name']} @ {location} :: {point['context']} [{point['source_type']}.{point['source_object']}]"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [
        f"# Debug points: {payload.get('target') or 'all objects'}",
        "",
        f"Total points: `{payload['total_points']}`",
        "",
    ]
    if not payload["points"]:
        lines.append("No debug points found.")
        return "\n".join(lines)
    lines.extend(["| Status | Procedure | Module | Line | Context | Source |", "|---|---|---|---:|---|---|"])
    for point in payload["points"]:
        lines.append(
            f"| {'OK' if point['exists'] else 'MISSING'} | `{point['procedure_name']}` | `{point['module_path'] or '-'}` | {point['line_number']} | {point['context']} | `{point['source_type']}.{point['source_object']}` |"
        )
    return "\n".join(lines)


def render_debug(graph: DependencyGraph, target: str, out_format: str = "text") -> str:
    payload = build_debug_payload(graph, target)
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
