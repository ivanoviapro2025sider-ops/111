#!/usr/bin/env python3
"""dep-analyzer entry-point: CLI, orchestration and output."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, Iterable, List

from bsl_analyzer import analyze_objects_bsl
from graph_builder import build_dependency_graph, collect_debug_points, get_dependency_edges
from output_debug import build_debug_payload, render_debug
from output_deps import build_deps_payload, render_deps
from output_full import build_full_payload, render_full
from output_rights import build_rights_payload, render_rights
from scanner import scan_configuration


def _resolve_target(target: str, object_keys: Iterable[str]) -> str:
    if not target:
        return ""
    if "." in target:
        return target
    matches = [key for key in object_keys if key.endswith(f".{target}")]
    if len(matches) == 1:
        return matches[0]
    return target


def _filter_debug_points(points, target: str):
    if not target:
        return points
    if "." in target:
        return [point for point in points if point.source_object == target]
    return [point for point in points if target.lower() in point.source_object.lower()]


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dep-analyzer",
        description="1C metadata dependency / debug / rights analyzer",
    )
    parser.add_argument("--config-path", "-ConfigPath", required=True, help="Path to 1C configuration dump")
    parser.add_argument("--mode", "-Mode", default="deps", choices=["deps", "debug", "rights", "full"])
    parser.add_argument("--target", "-Target", default="", help="Object key (e.g. Document.Sales) or role/object for rights")
    parser.add_argument("--depth", "-Depth", type=int, default=3, help="Traversal depth for dependency mode")
    parser.add_argument(
        "--out-format",
        "-OutFormat",
        default="text",
        choices=["text", "json", "md"],
        help="Output format",
    )
    parser.add_argument("--limit", "-Limit", type=int, default=150, help="Limit output rows")
    parser.add_argument("--offset", "-Offset", type=int, default=0, help="Offset for output rows")
    parser.add_argument("--out-file", "-OutFile", default="", help="Optional path to save output")
    parser.add_argument(
        "--direction",
        default="outgoing",
        choices=["outgoing", "incoming", "both"],
        help="Traversal direction for deps mode",
    )
    return parser


def _validate_args(args: argparse.Namespace) -> None:
    if args.depth < 1:
        raise ValueError("Depth must be >= 1")
    if args.limit < 1:
        raise ValueError("Limit must be >= 1")
    if args.offset < 0:
        raise ValueError("Offset must be >= 0")
    if not os.path.isdir(args.config_path):
        raise FileNotFoundError(f"ConfigPath not found: {args.config_path}")


def _write_output(text: str, out_file: str) -> None:
    if out_file:
        with open(out_file, "w", encoding="utf-8") as file_handle:
            file_handle.write(text)
    else:
        print(text)


def main(argv: List[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        _validate_args(args)
    except Exception as exc:  # pragma: no cover - CLI guardrail
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 2

    try:
        objects, roles, file_index = scan_configuration(args.config_path)
        analyze_objects_bsl(objects.values())
        graph = build_dependency_graph(objects, roles)

        resolved_target = _resolve_target(args.target, objects.keys())

        if args.mode == "deps":
            rows = get_dependency_edges(
                graph,
                target=resolved_target or None,
                depth=args.depth,
                direction=args.direction,
                limit=args.limit,
                offset=args.offset,
            )
            payload = build_deps_payload(
                rows,
                target=resolved_target,
                depth=args.depth,
                direction=args.direction,
                total_edges=len(graph.edges),
                limit=args.limit,
                offset=args.offset,
            )
            output = render_deps(payload, out_format=args.out_format)
        elif args.mode == "debug":
            points = collect_debug_points(objects)
            points = _filter_debug_points(points, resolved_target)
            payload = build_debug_payload(points, target=resolved_target, limit=args.limit, offset=args.offset)
            output = render_debug(payload, out_format=args.out_format)
        elif args.mode == "rights":
            payload = build_rights_payload(roles.values(), target=args.target, limit=args.limit, offset=args.offset)
            output = render_rights(payload, out_format=args.out_format)
        else:  # full
            dep_rows = get_dependency_edges(
                graph,
                target=resolved_target or None,
                depth=args.depth,
                direction=args.direction,
                limit=args.limit,
                offset=args.offset,
            )
            deps_payload = build_deps_payload(
                dep_rows,
                target=resolved_target,
                depth=args.depth,
                direction=args.direction,
                total_edges=len(graph.edges),
                limit=args.limit,
                offset=args.offset,
            )
            debug_points = collect_debug_points(objects)
            debug_payload = build_debug_payload(
                _filter_debug_points(debug_points, resolved_target),
                target=resolved_target,
                limit=args.limit,
                offset=args.offset,
            )
            rights_payload = build_rights_payload(roles.values(), target=args.target, limit=args.limit, offset=args.offset)
            payload = build_full_payload(deps_payload, debug_payload, rights_payload)
            payload["meta"] = {
                "objects_scanned": len(objects),
                "roles_scanned": len(roles),
                "types_detected": sorted(file_index.keys()),
            }
            output = render_full(payload, out_format=args.out_format)

        _write_output(output, args.out_file)
        return 0
    except Exception as exc:  # pragma: no cover - CLI guardrail
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
