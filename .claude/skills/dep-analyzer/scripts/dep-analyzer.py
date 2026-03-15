"""CLI entry point for the dep-analyzer skill."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from bsl_analyzer import analyze_bsl
from graph_builder import build_dependency_graph, resolve_target
from output_debug import build_debug_payload, render_debug
from output_deps import build_deps_payload, render_deps
from output_full import build_full_payload, render_full
from output_rights import build_rights_payload, render_rights
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_misc import parse_misc
from parser_register import parse_registers
from parser_role import parse_roles
from scanner import locate_configuration_xml, scan_configuration


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze 1C metadata dependencies, debug points and rights."
    )
    parser.add_argument("--config-path", "-ConfigPath", required=True, help="Path to configuration export root or Configuration.xml")
    parser.add_argument("--mode", "-Mode", default="deps", choices=["deps", "debug", "rights", "full"])
    parser.add_argument("--target", "-Target", default="", help="Metadata object key or role name")
    parser.add_argument("--depth", "-Depth", type=int, default=3, help="Traversal depth")
    parser.add_argument("--out-format", "-OutFormat", default="text", choices=["text", "json", "md"])
    parser.add_argument("--limit", "-Limit", type=int, default=150, help="Pagination limit")
    parser.add_argument("--offset", "-Offset", type=int, default=0, help="Pagination offset")
    parser.add_argument("--out-file", "-OutFile", default="", help="Optional output file path")
    return parser


def run_analysis(config_path: str):
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Configuration path not found: {config_path}")

    context = scan_configuration(config_path)
    if not context.objects and not locate_configuration_xml(config_path):
        raise RuntimeError("No metadata objects found. Expected a 1C XML export root or Configuration.xml.")

    objects = context.objects
    parse_catalogs(objects)
    parse_documents(objects)
    parse_registers(objects)
    parse_misc(objects)
    parse_roles(objects)
    analyze_bsl(objects, context.root_path)
    graph = build_dependency_graph(objects)
    return context, objects, graph


def render_mode(mode: str, graph, objects, target: Optional[str], depth: int, out_format: str, limit: int, offset: int) -> str:
    if mode == "deps":
        payload = build_deps_payload(graph, target=target, depth=depth, limit=limit, offset=offset)
        return render_deps(payload, out_format)
    if mode == "debug":
        payload = build_debug_payload(graph, objects, target=target, depth=depth, limit=limit, offset=offset)
        return render_debug(payload, out_format)
    if mode == "rights":
        payload = build_rights_payload(graph, target=target, limit=limit, offset=offset)
        return render_rights(payload, out_format)
    payload = build_full_payload(graph, objects, target=target, depth=depth, limit=limit, offset=offset)
    return render_full(payload, out_format)


def main(argv: Optional[list] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        _, objects, graph = run_analysis(args.config_path)
        resolved_target = resolve_target(args.target, graph) if args.target else None
        if args.target and not resolved_target:
            resolved_target = args.target

        rendered = render_mode(
            args.mode,
            graph,
            objects,
            resolved_target,
            args.depth,
            args.out_format,
            args.limit,
            args.offset,
        )
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    if args.out_file:
        output_path = os.path.abspath(args.out_file)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as stream:
            stream.write(rendered)
    else:
        print(rendered)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
