"""Entry-point и CLI для dep-analyzer skill."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bsl_analyzer import analyze_bsl
from graph_builder import build_edges
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


ALLOWED_MODES = {"deps", "debug", "rights", "full"}
ALLOWED_FORMATS = {"text", "json", "md"}
ALLOWED_DIRECTIONS = {"outgoing", "incoming", "both"}


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Парсинг аргументов командной строки."""
    parser = argparse.ArgumentParser(description="1C metadata dependency analyzer")
    parser.add_argument(
        "--config-path", required=True, dest="config_path",
        help="Path to 1C XML configuration export",
    )
    parser.add_argument(
        "--mode", default="deps", choices=sorted(ALLOWED_MODES),
        help="Output mode: deps | debug | rights | full",
    )
    parser.add_argument(
        "--target", default="",
        help="Target object key, e.g. Document.РеализацияТоваровУслуг",
    )
    parser.add_argument(
        "--depth", type=int, default=3,
        help="Traversal depth for deps/full (default: 3)",
    )
    parser.add_argument(
        "--out-format", default="text", choices=sorted(ALLOWED_FORMATS), dest="out_format",
        help="Output format: text | json | md",
    )
    parser.add_argument(
        "--limit", type=int, default=150,
        help="Result row limit (default: 150)",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Result row offset (default: 0)",
    )
    parser.add_argument(
        "--out-file", default="", dest="out_file",
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--direction", default="both", choices=sorted(ALLOWED_DIRECTIONS),
        help="Traversal direction for deps/full: outgoing | incoming | both",
    )
    return parser.parse_args(argv)


def _build_graph(config_path: str):
    """Оркестрация: сканирование → парсинг → анализ BSL → построение рёбер."""
    graph = scan_configuration(config_path=config_path)
    parse_catalogs(graph)
    parse_documents(graph)
    parse_registers(graph)
    parse_misc_objects(graph)
    parse_roles(graph)
    analyze_bsl(graph)
    build_edges(graph)
    return graph


def _render_output(graph, args: argparse.Namespace) -> str:
    """Диспетчеризация вывода по режиму."""
    if args.mode == "deps":
        return render_deps(
            graph=graph,
            target=args.target,
            depth=args.depth,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
            direction=args.direction,
        )
    if args.mode == "debug":
        return render_debug(
            graph=graph,
            target=args.target,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
        )
    if args.mode == "rights":
        return render_rights(
            graph=graph,
            target=args.target,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
        )
    # mode == "full"
    return render_full(
        graph=graph,
        target=args.target,
        depth=args.depth,
        out_format=args.out_format,
        limit=args.limit,
        offset=args.offset,
    )


def main(argv: list[str] | None = None) -> int:
    """Главная функция CLI."""
    args = parse_args(argv if argv is not None else sys.argv[1:])
    config_path = Path(args.config_path).expanduser().resolve()

    if not config_path.exists():
        print(f"[ERROR] Config path not found: {config_path}", file=sys.stderr)
        return 2

    if args.depth < 0:
        print("[ERROR] Depth must be >= 0", file=sys.stderr)
        return 2

    try:
        graph = _build_graph(str(config_path))
        output = _render_output(graph, args)
        if args.out_file:
            Path(args.out_file).expanduser().resolve().write_text(output, encoding="utf-8")
        else:
            print(output)
        return 0
    except Exception as exc:
        print(f"[ERROR] dep-analyzer failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
