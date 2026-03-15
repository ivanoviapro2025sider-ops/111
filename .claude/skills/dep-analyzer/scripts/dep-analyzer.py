"""dep-analyzer entry-point: CLI + orchestration."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from bsl_analyzer import analyze_bsl
from graph_builder import build_dependency_graph
from output_debug import format_debug
from output_deps import format_deps
from output_full import format_full
from output_rights import format_rights
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_misc import parse_misc
from parser_register import parse_registers
from parser_role import parse_roles
from scanner import ConfigurationScanner


def _resolve_target(target: str, objects: Dict[str, object]) -> str:
    if not target:
        return ""
    if target in objects:
        return target

    # short form: "<Name>"
    by_suffix = [key for key in objects if key.endswith(f".{target}")]
    if len(by_suffix) == 1:
        return by_suffix[0]

    # short form: "<Type>.<Name>" with case-insensitive type
    if "." in target:
        t_type, t_name = target.split(".", 1)
        normalized = f"{t_type[0].upper()}{t_type[1:]}.{t_name}" if t_type else target
        if normalized in objects:
            return normalized
    return target


def build_graph(config_path: str):
    scanner = ConfigurationScanner(config_path)
    objects = scanner.scan()

    parse_catalogs(objects)
    parse_documents(objects)
    parse_registers(objects)
    parse_misc(objects)
    roles = parse_roles(objects)
    analyze_bsl(objects, config_root=str(scanner.config_root))

    graph = build_dependency_graph(objects, roles=roles)
    return graph


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dep-analyzer",
        description="1C metadata dependency/debug/rights analyzer",
    )
    parser.add_argument("-c", "--config-path", required=True, help="Path to 1C dump root or Configuration.xml")
    parser.add_argument(
        "-m",
        "--mode",
        default="deps",
        choices=["deps", "debug", "rights", "full"],
        help="Output mode",
    )
    parser.add_argument("-t", "--target", default="", help="Object key (e.g. Document.SalesInvoice)")
    parser.add_argument("-d", "--depth", type=int, default=3, help="Traversal depth")
    parser.add_argument(
        "-f",
        "--out-format",
        default="text",
        choices=["text", "json", "md", "markdown"],
        help="Output format",
    )
    parser.add_argument("--direction", default="both", choices=["outgoing", "incoming", "both"])
    parser.add_argument("--limit", type=int, default=150, help="Pagination limit")
    parser.add_argument("--offset", type=int, default=0, help="Pagination offset")
    parser.add_argument("-o", "--out-file", default="", help="Write output to file")
    return parser


def run(args: argparse.Namespace) -> str:
    graph = build_graph(args.config_path)
    target = _resolve_target(args.target, graph.objects)

    if args.mode == "deps":
        return format_deps(
            graph,
            target=target,
            depth=args.depth,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
            direction=args.direction,
        )
    if args.mode == "debug":
        return format_debug(
            graph,
            target=target,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
        )
    if args.mode == "rights":
        return format_rights(
            graph,
            target=target,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
        )
    return format_full(
        graph,
        target=target,
        depth=args.depth,
        out_format=args.out_format,
        limit=args.limit,
        offset=args.offset,
        direction=args.direction,
    )


def main(argv: Optional[list[str]] = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)

    try:
        output = run(args)
    except Exception as exc:
        print(f"[ERROR] dep-analyzer failed: {exc}", file=sys.stderr)
        return 1

    if args.out_file:
        out_path = Path(args.out_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
