"""Output formatter for full mode (deps + debug + rights)."""

from __future__ import annotations

import json

from models import DependencyGraph
from output_debug import format_debug
from output_deps import format_deps
from output_rights import format_rights


def format_full(
    graph: DependencyGraph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
    direction: str = "both",
) -> str:
    """Build combined report for all analyzer modes."""
    fmt = out_format.lower()
    if fmt == "json":
        deps_json = json.loads(
            format_deps(
                graph,
                target=target,
                depth=depth,
                out_format="json",
                limit=limit,
                offset=offset,
                direction=direction,
            )
        )
        debug_json = json.loads(
            format_debug(
                graph,
                target=target,
                out_format="json",
                limit=limit,
                offset=offset,
            )
        )
        rights_json = json.loads(
            format_rights(
                graph,
                target=target,
                out_format="json",
                limit=limit,
                offset=offset,
            )
        )
        return json.dumps(
            {
                "mode": "full",
                "target": target,
                "deps": deps_json,
                "debug": debug_json,
                "rights": rights_json,
            },
            ensure_ascii=False,
            indent=2,
        )

    deps = format_deps(
        graph,
        target=target,
        depth=depth,
        out_format=fmt if fmt in {"md", "markdown"} else "text",
        limit=limit,
        offset=offset,
        direction=direction,
    )
    debug = format_debug(
        graph,
        target=target,
        out_format=fmt if fmt in {"md", "markdown"} else "text",
        limit=limit,
        offset=offset,
    )
    rights = format_rights(
        graph,
        target=target,
        out_format=fmt if fmt in {"md", "markdown"} else "text",
        limit=limit,
        offset=offset,
    )

    if fmt in {"md", "markdown"}:
        return "\n\n---\n\n".join([deps, debug, rights])
    return (
        "=== Dependencies ===\n"
        f"{deps}\n\n"
        "=== Debug points ===\n"
        f"{debug}\n\n"
        "=== Rights audit ===\n"
        f"{rights}"
    )
