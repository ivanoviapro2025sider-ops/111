"""Output formatting for deps mode."""

from __future__ import annotations

import json
from typing import Dict, List


def _render_text(payload: Dict) -> str:
    lines = [
        "Dependency analysis",
        f"Target: {payload.get('target') or '<all>'}",
        f"Depth: {payload.get('depth')}",
        f"Direction: {payload.get('direction')}",
        f"Total edges: {payload.get('total_edges')}",
        "",
    ]
    for row in payload.get("items", []):
        lines.append(
            f"[L{row['level']}] {row['source']} --({row['kind']})--> {row['target']}"
        )
    return "\n".join(lines)


def _render_markdown(payload: Dict) -> str:
    lines = [
        "# Dependency analysis",
        "",
        f"- **Target:** `{payload.get('target') or '<all>'}`",
        f"- **Depth:** `{payload.get('depth')}`",
        f"- **Direction:** `{payload.get('direction')}`",
        f"- **Total edges:** `{payload.get('total_edges')}`",
        "",
        "| Level | Source | Kind | Target |",
        "|---:|---|---|---|",
    ]
    for row in payload.get("items", []):
        lines.append(
            f"| {row['level']} | `{row['source']}` | `{row['kind']}` | `{row['target']}` |"
        )
    return "\n".join(lines)


def render_deps(payload: Dict, out_format: str = "text") -> str:
    """Render dependency output in text/json/md format."""
    out_format = (out_format or "text").lower()
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)


def build_deps_payload(
    items: List[Dict],
    *,
    target: str,
    depth: int,
    direction: str,
    total_edges: int,
    limit: int,
    offset: int,
) -> Dict:
    return {
        "mode": "deps",
        "target": target,
        "depth": depth,
        "direction": direction,
        "total_edges": total_edges,
        "limit": limit,
        "offset": offset,
        "items": items,
    }
