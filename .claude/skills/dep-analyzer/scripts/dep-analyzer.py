"""dep-analyzer entry-point: CLI and orchestration."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

from bsl_analyzer import analyze_bsl, collect_debug_points
from graph_builder import build_dependency_graph
from output_debug import render_debug
from output_deps import render_deps
from output_full import render_full
from output_rights import render_rights
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_misc import parse_misc
from parser_register import parse_registers
from parser_role import parse_roles
from scanner import scan_configuration


def _detect_config_root(config_path: str) -> str:
    abs_path = os.path.abspath(config_path)
    if os.path.isfile(abs_path):
        return os.path.dirname(abs_path)
    return abs_path


def run_analyzer(
    config_path: str,
    mode: str = "deps",
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
    out_file: str = "",
) -> str:
    config_root = _detect_config_root(config_path)
    objects = scan_configuration(config_root)

    parse_catalogs(objects)
    parse_documents(objects)
    parse_registers(objects)
    parse_misc(objects)
    roles = parse_roles(objects)
    analyze_bsl(objects, config_root=config_root)

    graph = build_dependency_graph(objects, roles=roles)
    debug_points = collect_debug_points(objects)

    if mode == "deps":
        output = render_deps(
            graph=graph,
            target=target,
            depth=depth,
            out_format=out_format,
            limit=limit,
            offset=offset,
        )
    elif mode == "debug":
        output = render_debug(
            debug_points=debug_points,
            target=target,
            out_format=out_format,
            limit=limit,
            offset=offset,
        )
    elif mode == "rights":
        output = render_rights(
            graph=graph,
            target=target,
            out_format=out_format,
            limit=limit,
            offset=offset,
        )
    elif mode == "full":
        output = render_full(
            graph=graph,
            debug_points=debug_points,
            target=target,
            depth=depth,
            out_format=out_format,
            limit=limit,
            offset=offset,
        )
    else:
        raise ValueError(f"Unsupported mode: {mode}")

    if out_file:
        out_path = os.path.abspath(out_file)
        out_dir = os.path.dirname(out_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as file:
            file.write(output)

    return output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="1C dependency/debug/rights analyzer")
    parser.add_argument("--config-path", "-ConfigPath", dest="config_path", required=True, help="Path to 1C config export")
    parser.add_argument(
        "--mode",
        "-Mode",
        dest="mode",
        default="deps",
        choices=["deps", "debug", "rights", "full"],
        help="Output mode",
    )
    parser.add_argument("--target", "-Target", dest="target", default="", help="Root metadata object key")
    parser.add_argument("--depth", "-Depth", dest="depth", type=int, default=3, help="Traversal depth")
    parser.add_argument(
        "--out-format",
        "-OutFormat",
        dest="out_format",
        default="text",
        choices=["text", "json", "md"],
        help="Output format",
    )
    parser.add_argument("--limit", "-Limit", dest="limit", type=int, default=150, help="Pagination limit")
    parser.add_argument("--offset", "-Offset", dest="offset", type=int, default=0, help="Pagination offset")
    parser.add_argument("--out-file", "-OutFile", dest="out_file", default="", help="Write output to file path")
    return parser


def main(argv: Optional[list] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        output = run_analyzer(
            config_path=args.config_path,
            mode=args.mode,
            target=args.target,
            depth=args.depth,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
            out_file=args.out_file,
        )
        if not args.out_file:
            print(output)
        return 0
    except Exception as exc:  # pragma: no cover - defensive CLI behavior.
        print(f"[ERROR] dep-analyzer failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
