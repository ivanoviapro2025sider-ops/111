#!/usr/bin/env python3
"""dep-analyzer entry point."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict

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
from scanner import get_objects_by_type, scan_configuration


def _configure_stdio() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def _paginate(text: str, limit: int, offset: int) -> str:
    lines = text.splitlines()
    if offset > 0:
        lines = lines[offset:]
    if limit > 0 and len(lines) > limit:
        truncated = lines[:limit]
        truncated.extend(
            [
                "",
                f"[TRUNCATED] Shown {limit} lines starting from offset {offset}. Use -Offset {offset + limit} to continue.",
            ]
        )
        lines = truncated
    return "\n".join(lines)


def _write_output(text: str, out_file: str) -> None:
    output_path = os.path.abspath(out_file)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8-sig") as handle:
        handle.write(text)


def analyze_configuration(config_path: str):
    root_dir, config_xml, objects = scan_configuration(config_path)
    if not os.path.isdir(root_dir):
        raise FileNotFoundError(f"Configuration path not found: {config_path}")
    if not objects:
        raise RuntimeError(
            f"No metadata objects found under '{root_dir}'. "
            f"Expected a 1C XML dump with Configuration.xml and metadata folders."
        )

    parse_catalogs(get_objects_by_type(objects, "Catalog"))
    parse_documents(get_objects_by_type(objects, "Document"))
    parse_registers(
        get_objects_by_type(
            objects,
            "InformationRegister",
            "AccumulationRegister",
            "AccountingRegister",
            "CalculationRegister",
        )
    )
    parse_roles(get_objects_by_type(objects, "Role"))

    parsed_keys = {
        obj.key
        for obj in get_objects_by_type(
            objects,
            "Catalog",
            "Document",
            "InformationRegister",
            "AccumulationRegister",
            "AccountingRegister",
            "CalculationRegister",
            "Role",
        )
    }
    misc_objects = [obj for obj in objects.values() if obj.key not in parsed_keys]
    parse_misc_objects(misc_objects)
    analyze_bsl(objects.values(), root_dir=root_dir)

    graph = build_dependency_graph(objects)
    return root_dir, config_xml, objects, graph


def main() -> int:
    _configure_stdio()

    parser = argparse.ArgumentParser(description="Analyze 1C metadata dependencies, debug points, and rights.", allow_abbrev=False)
    parser.add_argument("-ConfigPath", required=True, help="Path to XML dump root or Configuration.xml")
    parser.add_argument("-Mode", default="deps", choices=["deps", "debug", "rights", "full"], help="Output mode")
    parser.add_argument("-Target", default="", help="Object target, for example Document.SalesInvoice or SalesInvoice")
    parser.add_argument("-Depth", type=int, default=3, help="Traversal depth for dependency mode")
    parser.add_argument("-OutFormat", default="text", choices=["text", "json", "md"], help="Output format")
    parser.add_argument("-Limit", type=int, default=150, help="Maximum output lines for text/markdown")
    parser.add_argument("-Offset", type=int, default=0, help="Line offset for text/markdown")
    parser.add_argument("-OutFile", default="", help="Write result to file")
    args = parser.parse_args()

    try:
        _, _, _, graph = analyze_configuration(args.ConfigPath)
        if args.Mode == "deps":
            rendered = render_deps(graph, target=args.Target, depth=args.Depth, out_format=args.OutFormat)
        elif args.Mode == "debug":
            rendered = render_debug(graph, target=args.Target, out_format=args.OutFormat)
        elif args.Mode == "rights":
            rendered = render_rights(graph, target=args.Target, out_format=args.OutFormat)
        else:
            rendered = render_full(graph, target=args.Target, depth=args.Depth, out_format=args.OutFormat)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    final_output = rendered
    if args.OutFormat in {"text", "md"}:
        final_output = _paginate(rendered, limit=args.Limit, offset=args.Offset)

    if args.OutFile:
        _write_output(final_output, args.OutFile)
        print(f"Output written to {os.path.abspath(args.OutFile)}")
    else:
        print(final_output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
