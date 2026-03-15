"""Output formatting for full mode (deps + debug + rights)."""

from __future__ import annotations

import json
from typing import Dict


def build_full_payload(deps_payload: Dict, debug_payload: Dict, rights_payload: Dict) -> Dict:
    return {
        "mode": "full",
        "deps": deps_payload,
        "debug": debug_payload,
        "rights": rights_payload,
    }


def _render_text(payload: Dict) -> str:
    deps = payload.get("deps", {})
    debug = payload.get("debug", {})
    rights = payload.get("rights", {})
    lines = [
        "Full dep-analyzer report",
        "",
        f"Dependencies: {deps.get('total_edges', 0)}",
        f"Debug points: {debug.get('total_points', 0)}",
        f"Rights entries: {rights.get('total_items', 0)}",
        "",
        "Use --out-format json or md for detailed output.",
    ]
    return "\n".join(lines)


def _render_markdown(payload: Dict) -> str:
    deps = payload.get("deps", {})
    debug = payload.get("debug", {})
    rights = payload.get("rights", {})
    return "\n".join(
        [
            "# Full dep-analyzer report",
            "",
            f"- **Dependencies:** `{deps.get('total_edges', 0)}`",
            f"- **Debug points:** `{debug.get('total_points', 0)}`",
            f"- **Rights entries:** `{rights.get('total_items', 0)}`",
            "",
            "Детализация доступна в JSON-режиме (`--out-format json`).",
        ]
    )


def render_full(payload: Dict, out_format: str = "text") -> str:
    out_format = (out_format or "text").lower()
    if out_format == "json":
        return json.dumps(payload, ensure_ascii=False, indent=2)
    if out_format == "md":
        return _render_markdown(payload)
    return _render_text(payload)
