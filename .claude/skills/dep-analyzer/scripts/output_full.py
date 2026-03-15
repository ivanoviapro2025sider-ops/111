"""Composite output formatter for full analysis."""

from __future__ import annotations

import json
from typing import Dict, Optional

from models import DependencyGraph, ObjectInfo
from output_debug import build_debug_payload, render_debug
from output_deps import build_deps_payload, render_deps
from output_rights import build_rights_payload, render_rights


def build_full_payload(
    graph: DependencyGraph,
    objects: Dict[str, ObjectInfo],
    *,
    target: Optional[str] = None,
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> dict:
    return {
        "mode": "full",
        "target": target or "",
        "deps": build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset),
        "debug": build_debug_payload(graph, objects, target=target, depth=depth, limit=limit, offset=offset),
        "rights": build_rights_payload(graph, target=target, limit=limit, offset=offset),
    }


def render_full(payload: dict, out_format: str = "text") -> str:
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return "\n\n".join(
            [
                "# Full analysis",
                render_deps(payload["deps"], "md"),
                render_debug(payload["debug"], "md"),
                render_rights(payload["rights"], "md"),
            ]
        )
    return "\n\n".join(
        [
            "Full analysis",
            render_deps(payload["deps"], "text"),
            render_debug(payload["debug"], "text"),
            render_rights(payload["rights"], "text"),
        ]
    )
