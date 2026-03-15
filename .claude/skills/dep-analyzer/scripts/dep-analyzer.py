"""CLI entry point for the dep-analyzer skill."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from bsl_analyzer import analyze_bsl_modules
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
from scanner import scan_configuration


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze 1C metadata dependencies, debug points, and rights.")
    parser.add_argument("--config-path", "--ConfigPath", dest="config_path", required=True, help="Path to dumped 1C configuration directory")
    parser.add_argument("--mode", "--Mode", choices=["deps", "debug", "rights", "full"], default="deps", help="Analysis mode")
    parser.add_argument("--target", "--Target", default="", help="Target object name or full key, for example Catalog.Номенклатура")
    parser.add_argument("--depth", "--Depth", type=int, default=3, help="Dependency traversal depth")
    parser.add_argument("--out-format", "--OutFormat", dest="out_format", choices=["text", "json", "md"], default="text", help="Output format")
    parser.add_argument("--limit", "--Limit", type=int, default=150, help="Max items in output page, <= 0 means all")
    parser.add_argument("--offset", "--Offset", type=int, default=0, help="Page offset")
    parser.add_argument("--out-file", "--OutFile", dest="out_file", default="", help="Optional output file path")
    return parser


def build_graph(config_path: str):
    object_index = scan_configuration(config_path)
    parse_catalogs(object_index)
    parse_documents(object_index)
    parse_registers(object_index)
    parse_misc_objects(object_index)
    roles = parse_roles(object_index)
    analyze_bsl_modules(config_path, object_index)
    return build_dependency_graph(object_index, roles=roles)


def render_mode(graph, mode: str, out_format: str, target: str, depth: int, limit: int, offset: int) -> str:
    if mode == "deps":
        return render_deps(graph, out_format=out_format, target=target, depth=depth, limit=limit, offset=offset)
    if mode == "debug":
        return render_debug(graph, out_format=out_format, target=target, depth=depth, limit=limit, offset=offset)
    if mode == "rights":
        return render_rights(graph, out_format=out_format, target=target, limit=limit, offset=offset)
    return render_full(graph, out_format=out_format, target=target, depth=depth, limit=limit, offset=offset)


def write_output(content: str, out_file: str) -> None:
    if not out_file:
        print(content)
        return
    output_path = Path(out_file).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    print(str(output_path))


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    try:
        graph = build_graph(args.config_path)
        content = render_mode(
            graph,
            mode=args.mode,
            out_format=args.out_format,
            target=args.target,
            depth=max(args.depth, 0),
            limit=args.limit,
            offset=max(args.offset, 0),
        )
        write_output(content, args.out_file)
        return 0
    except Exception as exc:  # pragma: no cover - CLI guard rail
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
