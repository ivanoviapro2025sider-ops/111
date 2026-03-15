"""Combined full-mode renderer."""

from __future__ import annotations

import json

from models import DependencyGraph
from output_debug import build_debug_payload, render_debug
from output_deps import build_deps_payload, render_deps
from output_rights import build_rights_payload, render_rights


def render_full(graph: DependencyGraph, target: str, depth: int, out_format: str = "text") -> str:
    deps_payload = build_deps_payload(graph, target=target, depth=depth, direction="both")
    debug_payload = build_debug_payload(graph, target=target)
    rights_payload = build_rights_payload(graph, target=target)

    if out_format == "json":
        return json.dumps(
            {
                "mode": "full",
                "target": target,
                "deps": deps_payload,
                "debug": debug_payload,
                "rights": rights_payload,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        sections = [
            "# Full dep-analyzer report",
            "",
            render_deps(graph, target=target, depth=depth, out_format="md"),
            "",
            render_debug(graph, target=target, out_format="md"),
            "",
            render_rights(graph, target=target, out_format="md"),
        ]
        return "\n".join(sections)

    sections = [
        "=== Full dep-analyzer report ===",
        "",
        render_deps(graph, target=target, depth=depth, out_format="text"),
        "",
        render_debug(graph, target=target, out_format="text"),
        "",
        render_rights(graph, target=target, out_format="text"),
    ]
    return "\n".join(sections)
