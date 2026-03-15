#!/usr/bin/env python3
"""Главный entry-point skill dep-analyzer."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Tuple

from bsl_analyzer import analyze_bsl
from graph_builder import build_dependency_graph
from output_debug import render_debug
from output_deps import render_deps
from output_full import render_full
from output_rights import render_rights
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_misc import parse_misc_objects
from parser_register import parse_registers
from parser_role import parse_roles
from scanner import discover_configuration_root, scan_configuration

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze 1C metadata dependencies, debug points, and rights",
        allow_abbrev=False,
    )
    parser.add_argument("-ConfigPath", required=True, help="Path to configuration XML dump root or Configuration.xml")
    parser.add_argument("-Mode", choices=["deps", "debug", "rights", "full"], default="deps")
    parser.add_argument("-Target", default="", help="Object key / name / role name to focus on")
    parser.add_argument("-Depth", type=int, default=3, help="Traversal depth for deps/debug")
    parser.add_argument("-OutFormat", choices=["text", "json", "md"], default="text")
    parser.add_argument("-Limit", type=int, default=150, help="Max output lines (text/md only, 0 = unlimited)")
    parser.add_argument("-Offset", type=int, default=0, help="Skip N output lines (text/md only)")
    parser.add_argument("-OutFile", default="", help="Write result to file")
    return parser.parse_args()


def build_analysis(config_path: str):
    config_root = discover_configuration_root(config_path)
    objects = scan_configuration(config_root)
    objects = parse_catalogs(objects)
    objects = parse_documents(objects)
    objects = parse_registers(objects)
    objects = parse_misc_objects(objects)
    roles = parse_roles(config_root, objects)
    debug_points = analyze_bsl(objects, config_root)
    graph = build_dependency_graph(objects, roles)
    return graph, debug_points


def paginate_output(output_text: str, limit: int, offset: int, out_format: str) -> str:
    if out_format == "json":
        return output_text

    lines = output_text.splitlines()
    total = len(lines)

    if offset > 0:
        if offset >= total:
            return f"[INFO] Offset {offset} exceeds total lines ({total}). Nothing to show."
        lines = lines[offset:]

    if limit > 0 and len(lines) > limit:
        lines = lines[:limit] + [
            "",
            f"[TRUNCATED] Shown {limit} of {total} lines. Use -Offset {offset + limit} to continue.",
        ]

    return "\n".join(lines)


def write_output(output_text: str, out_file: str) -> None:
    if out_file:
        absolute = out_file if os.path.isabs(out_file) else os.path.abspath(out_file)
        parent_dir = os.path.dirname(absolute)
        if parent_dir and not os.path.isdir(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
        with open(absolute, "w", encoding="utf-8-sig") as handle:
            handle.write(output_text)
        print(f"Output written to {absolute}")
        return
    print(output_text)


def render_mode(mode: str, graph, debug_points, target: str, depth: int, out_format: str) -> str:
    if mode == "deps":
        return render_deps(graph, target=target, depth=depth, out_format=out_format)
    if mode == "debug":
        return render_debug(graph, debug_points, target=target, depth=depth, out_format=out_format)
    if mode == "rights":
        return render_rights(graph, target=target, out_format=out_format)
    return render_full(graph, debug_points, target=target, depth=depth, out_format=out_format)


def main() -> int:
    args = parse_args()
    config_root = discover_configuration_root(args.ConfigPath)
    if not os.path.exists(config_root):
        print(f"[ERROR] Config path not found: {args.ConfigPath}", file=sys.stderr)
        return 1

    try:
        graph, debug_points = build_analysis(config_root)
        rendered = render_mode(args.Mode, graph, debug_points, args.Target, args.Depth, args.OutFormat)
        rendered = paginate_output(rendered, args.Limit, args.Offset, args.OutFormat)
        write_output(rendered, args.OutFile)
        return 0
    except Exception as exc:  # pragma: no cover - last-resort CLI guard
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
