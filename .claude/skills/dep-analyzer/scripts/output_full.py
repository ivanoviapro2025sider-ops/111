"""Full mode output formatter combining deps/debug/rights."""

from __future__ import annotations

import json

from output_debug import render_debug
from output_deps import render_deps
from output_rights import render_rights


def render_full(
    graph,
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    if out_format == "json":
        deps_json = json.loads(
            render_deps(
                graph=graph,
                target=target,
                depth=depth,
                out_format="json",
                limit=limit,
                offset=offset,
            )
        )
        debug_json = json.loads(
            render_debug(
                graph=graph,
                target=target,
                out_format="json",
                limit=limit,
                offset=offset,
            )
        )
        rights_json = json.loads(
            render_rights(
                graph=graph,
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
                "depth": depth,
                "deps": deps_json,
                "debug": debug_json,
                "rights": rights_json,
            },
            ensure_ascii=False,
            indent=2,
        )

    if out_format == "md":
        deps_md = render_deps(graph, target=target, depth=depth, out_format="md", limit=limit, offset=offset)
        debug_md = render_debug(graph, target=target, out_format="md", limit=limit, offset=offset)
        rights_md = render_rights(graph, target=target, out_format="md", limit=limit, offset=offset)
        return "\n\n---\n\n".join(
            [
                "# Dependency Analyzer: full",
                deps_md,
                debug_md,
                rights_md,
            ]
        )

    deps_text = render_deps(graph, target=target, depth=depth, out_format="text", limit=limit, offset=offset)
    debug_text = render_debug(graph, target=target, out_format="text", limit=limit, offset=offset)
    rights_text = render_rights(graph, target=target, out_format="text", limit=limit, offset=offset)
    return "\n\n".join(
        [
            "Mode: full",
            deps_text,
            debug_text,
            rights_text,
        ]
    )

