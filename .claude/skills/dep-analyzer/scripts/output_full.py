"""Сборка полного отчёта deps + debug + rights."""

from __future__ import annotations

import json

from models import DebugPoint, DependencyGraph
from output_debug import render_debug
from output_deps import render_deps
from output_rights import render_rights


def render_full(
    graph: DependencyGraph,
    debug_points: list[DebugPoint],
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
) -> str:
    """Сформировать полный комбинированный отчёт."""

    if out_format == "json":
        payload = {
            "mode": "full",
            "deps": json.loads(render_deps(graph, target=target, depth=depth, out_format="json")),
            "debug": json.loads(render_debug(graph, debug_points, target=target, depth=depth, out_format="json")),
            "rights": json.loads(render_rights(graph, target=target, out_format="json")),
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    if out_format == "md":
        return "\n\n".join(
            [
                "# Full dep-analyzer report",
                render_deps(graph, target=target, depth=depth, out_format="md"),
                render_debug(graph, debug_points, target=target, depth=depth, out_format="md"),
                render_rights(graph, target=target, out_format="md"),
            ]
        )

    return "\n\n".join(
        [
            "=== Full dep-analyzer report ===",
            render_deps(graph, target=target, depth=depth, out_format="text"),
            render_debug(graph, debug_points, target=target, depth=depth, out_format="text"),
            render_rights(graph, target=target, out_format="text"),
        ]
    )
