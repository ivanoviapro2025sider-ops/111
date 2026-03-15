"""Output formatting for debug mode."""

from __future__ import annotations

import json
from typing import Dict, Iterable, List

from models import DebugPoint


def _point_to_dict(point: DebugPoint) -> Dict:
    return {
        "procedure_name": point.procedure_name,
        "module_path": point.module_path,
        "line_number": point.line_number,
        "context": point.context,
        "exists": point.exists,
        "source_object": point.source_object,
        "source_type": point.source_type,
    }


def build_debug_payload(points: Iterable[DebugPoint], *, target: str, limit: int, offset: int) -> Dict:
    point_rows: List[Dict] = [_point_to_dict(item) for item in points]
    return {
        "mode": "debug",
        "target": target,
        "total_points": len(point_rows),
        "limit": limit,
        "offset": offset,
        "items": point_rows[offset : offset + limit],
    }


def _render_text(payload: Dict) -> str:
    lines = [
        "Debug points analysis",
        f"Target: {payload.get('target') or '<all>'}",
        f"Total points: {payload.get('total_points')}",
        "",
    ]
    for row in payload.get("items", []):
        exists_mark = "OK" if row["exists"] else "MISSING"
        lines.append(
            f"[{exists_mark}] {row['source_object']}: {row['procedure_name']} "
            f"({row['module_path']}:{row['line_number']}) [{row['context']}]"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict) -> str:
    lines = [
        "# Debug points analysis",
        "",
        f"- **Target:** `{payload.get('target') or '<all>'}`",
        f"- **Total points:** `{payload.get('total_points')}`",
        "",
        "| Exists | Source object | Procedure | Module path | Line | Context |",
        "|---|---|---|---|---:|---|",
    ]
    for row in payload.get("items", []):
        exists_mark = "✅" if row["exists"] else "❌"
        lines.append(
            f"| {exists_mark} | `{row['source_object']}` | `{row['procedure_name']}` | "
            f"`{row['module_path']}` | {row['line_number']} | {row['context']} |"
        )
    return "\n".join(lines)


def render_debug(payload: Dict, out_format: str = "text") -> str:
    out_format = (out_format or "text").lower()
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
