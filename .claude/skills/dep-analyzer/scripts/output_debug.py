"""Formatting for debug output."""

from __future__ import annotations

import json
from typing import Dict, List, Optional, Set

from bsl_analyzer import collect_intrinsic_debug_points, resolve_handler_debug_point
from graph_builder import collect_related_nodes
from models import DebugPoint, DependencyGraph, ObjectInfo


def _dedupe_debug_points(points: List[DebugPoint]) -> List[DebugPoint]:
    seen = set()
    result = []
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
        result.append(point)
    return result


def _point_to_dict(point: DebugPoint) -> dict:
    return {
        "procedure_name": point.procedure_name,
        "module_path": point.module_path,
        "line_number": point.line_number,
        "context": point.context,
        "exists": point.exists,
        "source_object": point.source_object,
        "source_type": point.source_type,
    }


def build_debug_payload(
    graph: DependencyGraph,
    objects: Dict[str, ObjectInfo],
    *,
    target: Optional[str] = None,
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> dict:
    """Build payload with resolved BSL breakpoints."""

    if target and target in graph.objects:
        selected_nodes, _ = collect_related_nodes(graph, target, depth, direction="both")
    else:
        selected_nodes = set(graph.objects)

    points: List[DebugPoint] = []
    for key in sorted(selected_nodes):
        obj_info = objects.get(key)
        if obj_info is None:
            continue

        intrinsic = collect_intrinsic_debug_points(obj_info)
        if intrinsic:
            points.extend(intrinsic)
        elif obj_info.procedures:
            for procedure in obj_info.procedures:
                points.append(
                    DebugPoint(
                        procedure_name=procedure.name,
                        module_path=procedure.module_path,
                        line_number=procedure.line_number,
                        context="Процедура/функция модуля",
                        exists=True,
                        source_object=obj_info.name,
                        source_type=obj_info.obj_type,
                    )
                )

    for subscription in objects.values():
        if subscription.obj_type != "EventSubscription" or not subscription.handler:
            continue
        if target and not any(source_type in selected_nodes for source_type in subscription.source_types):
            continue
        points.append(
            resolve_handler_debug_point(
                subscription.handler,
                objects,
                context=f"Подписка на событие: {subscription.event or 'handler'}",
                source_object=subscription.name,
                source_type=subscription.obj_type,
            )
        )

    points = _dedupe_debug_points(points)
    returned_points = points[offset : offset + limit] if limit > 0 else points[offset:]

    return {
        "mode": "debug",
        "target": target or "",
        "depth": depth,
        "summary": {
            "objects_considered": len(selected_nodes),
            "debug_points": len(points),
            "returned_debug_points": len(returned_points),
            "limit": limit,
            "offset": offset,
        },
        "debug_points": [_point_to_dict(point) for point in returned_points],
    }


def render_debug(payload: dict, out_format: str = "text") -> str:
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        lines = [
            "# Debug points",
            "",
            f"- Target: `{payload['target'] or 'ALL'}`",
            f"- Depth: `{payload['depth']}`",
            f"- Debug points: `{payload['summary']['debug_points']}`",
            "",
            "| Procedure | Module | Line | Exists | Context | Source |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for point in payload["debug_points"]:
            lines.append(
                f"| `{point['procedure_name']}` | `{point['module_path']}` | `{point['line_number']}` | `{point['exists']}` | {point['context']} | `{point['source_type']}.{point['source_object']}` |"
            )
        return "\n".join(lines)

    lines = [
        "Debug points",
        f"Target: {payload['target'] or 'ALL'}",
        f"Depth: {payload['depth']}",
        f"Debug points: {payload['summary']['debug_points']}",
        "",
    ]
    for point in payload["debug_points"]:
        exists = "OK" if point["exists"] else "MISSING"
        lines.append(
            f"- {point['procedure_name']} @ {point['module_path']}:{point['line_number']} [{exists}] "
            f"- {point['context']} ({point['source_type']}.{point['source_object']})"
        )
    return "\n".join(lines)
