"""Combined output formatter for full mode."""

from __future__ import annotations

import json

from models import DependencyGraph
from output_debug import build_debug_payload, render_debug
from output_deps import build_deps_payload, render_deps
from output_rights import build_rights_payload, render_rights


def render_full(
    graph: DependencyGraph,
    out_format: str = "text",
    target: str = "",
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> str:
    deps_payload = build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset)
    debug_payload = build_debug_payload(graph, target=target, depth=depth, limit=limit, offset=offset)
    rights_payload = build_rights_payload(graph, target=target, limit=limit, offset=offset)

    if out_format == "json":
        return json.dumps(
            {
                "mode": "full",
                "target": target,
                "depth": depth,
                "deps": deps_payload,
                "debug": debug_payload,
                "rights": rights_payload,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        return "\n\n".join(
            [
                "# Full Analysis",
                render_deps(graph, out_format="md", target=target, depth=depth, limit=limit, offset=offset),
                render_debug(graph, out_format="md", target=target, depth=depth, limit=limit, offset=offset),
                render_rights(graph, out_format="md", target=target, limit=limit, offset=offset),
            ]
        )

    return "\n\n".join(
        [
            "Mode: full",
            render_deps(graph, out_format="text", target=target, depth=depth, limit=limit, offset=offset),
            render_debug(graph, out_format="text", target=target, depth=depth, limit=limit, offset=offset),
            render_rights(graph, out_format="text", target=target, limit=limit, offset=offset),
        ]
    )
