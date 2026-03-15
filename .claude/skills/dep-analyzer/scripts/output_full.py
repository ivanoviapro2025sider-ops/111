"""Output rendering for full mode (deps + debug + rights)."""

from __future__ import annotations

import json
from typing import Dict, List

from models import DebugPoint, DependencyGraph
from output_debug import build_debug_payload
from output_deps import build_deps_payload
from output_rights import build_rights_payload


def build_full_payload(
    graph: DependencyGraph,
    debug_points: List[DebugPoint],
    target: str = "",
    depth: int = 3,
    limit: int = 150,
    offset: int = 0,
) -> Dict[str, object]:
    return {
        "mode": "full",
        "deps": build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset),
        "debug": build_debug_payload(debug_points, target=target, limit=limit, offset=offset),
        "rights": build_rights_payload(graph, target=target, limit=limit, offset=offset),
    }


def _render_text(payload: Dict[str, object]) -> str:
    deps = payload["deps"]
    debug = payload["debug"]
    rights = payload["rights"]
    lines = [
        "Mode: full",
        f"Deps edges: {deps['returned_edges']}/{deps['total_edges']}",
        f"Debug points: {debug['returned_points']}/{debug['total_points']}",
        f"Roles: {rights['returned_roles']}/{rights['total_roles']}",
        "",
        "Tip: use --out-format json for full details.",
    ]
    return "\n".join(lines)


def _render_markdown(payload: Dict[str, object]) -> str:
    deps = payload["deps"]
    debug = payload["debug"]
    rights = payload["rights"]
    return "\n".join(
        [
            "# Full Dependency Analyzer Report",
            "",
            f"- **Deps edges:** `{deps['returned_edges']}/{deps['total_edges']}`",
            f"- **Debug points:** `{debug['returned_points']}/{debug['total_points']}`",
            f"- **Roles:** `{rights['returned_roles']}/{rights['total_roles']}`",
            "",
            "Use JSON output for complete machine-readable data.",
        ]
    )


def render_full(
    graph: DependencyGraph,
    debug_points: List[DebugPoint],
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    payload = build_full_payload(
        graph=graph,
        debug_points=debug_points,
        target=target,
        depth=depth,
        limit=limit,
        offset=offset,
    )
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
