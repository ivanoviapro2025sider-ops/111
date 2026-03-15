"""Output rendering for debug mode."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DebugPoint


def build_debug_payload(
    debug_points: List[DebugPoint],
    target: str = "",
    limit: int = 150,
    offset: int = 0,
) -> Dict[str, object]:
    filtered = debug_points
    if target:
        target_lc = target.lower()
        filtered = [
            point
            for point in debug_points
            if target_lc in f"{point.source_type}.{point.source_object}".lower()
            or target_lc in point.procedure_name.lower()
        ]

    total = len(filtered)
    sliced = filtered[offset : offset + limit] if limit >= 0 else filtered[offset:]
    payload_points = [
        {
            "procedure_name": point.procedure_name,
            "module_path": point.module_path,
            "line_number": point.line_number,
            "context": point.context,
            "exists": point.exists,
            "source_object": point.source_object,
            "source_type": point.source_type,
        }
        for point in sliced
    ]

    return {
        "mode": "debug",
        "target": target,
        "total_points": total,
        "returned_points": len(payload_points),
        "offset": offset,
        "limit": limit,
        "points": payload_points,
    }


def _render_text(payload: Dict[str, object]) -> str:
    lines = [
        f"Mode: {payload['mode']}",
        f"Target: {payload['target'] or '<all>'}",
        f"Breakpoints: {payload['returned_points']}/{payload['total_points']}",
        "",
    ]
    for point in payload["points"]:
        status = "OK" if point["exists"] else "MISSING"
        lines.append(
            f"[{status}] {point['source_type']}.{point['source_object']} :: "
            f"{point['procedure_name']} @ {point['module_path']}:{point['line_number']} "
            f"({point['context']})"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    lines = [
        "# Debug Breakpoints",
        "",
        f"- **Target:** `{payload['target'] or '<all>'}`",
        f"- **Points:** `{payload['returned_points']}/{payload['total_points']}`",
        "",
        "| Exists | Source | Procedure | Module | Line | Context |",
        "|---|---|---|---|---:|---|",
    ]
    for point in payload["points"]:
        exists = "✅" if point["exists"] else "❌"
        source = f"{point['source_type']}.{point['source_object']}"
        lines.append(
            f"| {exists} | `{source}` | `{point['procedure_name']}` | "
            f"`{point['module_path']}` | {point['line_number']} | {point['context']} |"
        )
    return "\n".join(lines)


def render_debug(
    debug_points: List[DebugPoint],
    target: str = "",
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    payload = build_debug_payload(debug_points, target=target, limit=limit, offset=offset)
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
