#!/usr/bin/env python3
"""dep-analyzer: Анализатор зависимостей, отладки и прав метаданных 1С.

Entry-point: CLI-оркестратор, координирует сканирование → парсинг → граф → вывод.
"""

import argparse
import os
import sys
import time


def main():
    parser = argparse.ArgumentParser(
        description="Анализатор зависимостей метаданных 1С",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python dep-analyzer.py --config-path ./MyConfig --mode deps --target "Document.РеализацияТоваровУслуг"
  python dep-analyzer.py --config-path ./MyConfig --mode debug --target "Document.РеализацияТоваровУслуг" --depth 2
  python dep-analyzer.py --config-path ./MyConfig --mode rights --out-format json
  python dep-analyzer.py --config-path ./MyConfig --mode full --target "Catalog.Номенклатура" --out-format md
        """,
    )

    parser.add_argument(
        "--config-path", required=True,
        help="Путь к каталогу конфигурации 1С (с Configuration.xml)",
    )
    parser.add_argument(
        "--mode", default="deps",
        choices=["deps", "debug", "rights", "full"],
        help="Режим анализа: deps, debug, rights, full (по умолчанию: deps)",
    )
    parser.add_argument(
        "--target", default="",
        help="Целевой объект (например, Document.РеализацияТоваровУслуг)",
    )
    parser.add_argument(
        "--depth", type=int, default=3,
        help="Глубина обхода графа (по умолчанию: 3)",
    )
    parser.add_argument(
        "--out-format", default="text",
        choices=["text", "json", "md"],
        help="Формат вывода: text, json, md (по умолчанию: text)",
    )
    parser.add_argument(
        "--limit", type=int, default=150,
        help="Максимум записей в выводе (по умолчанию: 150)",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Смещение для пагинации (по умолчанию: 0)",
    )
    parser.add_argument(
        "--out-file", default="",
        help="Путь к файлу для записи результата (по умолчанию: stdout)",
    )

    args = parser.parse_args()

    config_path = os.path.abspath(args.config_path)
    if not os.path.isdir(config_path):
        print(f"[ERROR] Config path not found or not a directory: {config_path}", file=sys.stderr)
        sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    try:
        from scanner import scan_configuration
        from parser_catalog import parse_catalogs
        from parser_document import parse_documents
        from parser_register import parse_registers
        from parser_misc import parse_misc_objects
        from parser_role import parse_roles
        from bsl_analyzer import analyze_all_bsl
        from graph_builder import build_graph, find_target_key, get_subgraph
    except ImportError as e:
        print(f"[ERROR] Failed to import module: {e}", file=sys.stderr)
        print("Make sure all dep-analyzer modules are in the same directory.", file=sys.stderr)
        sys.exit(1)

    t_start = time.time()
    print(f"[dep-analyzer] Scanning configuration: {config_path}", file=sys.stderr)

    objects = scan_configuration(config_path)
    if not objects:
        print("[ERROR] No objects found in configuration.", file=sys.stderr)
        sys.exit(1)

    print(f"[dep-analyzer] Found {len(objects)} objects. Parsing...", file=sys.stderr)

    parse_catalogs(objects)
    parse_documents(objects)
    parse_registers(objects)
    parse_misc_objects(objects)
    parse_roles(objects)

    print("[dep-analyzer] Analyzing BSL code...", file=sys.stderr)
    analyze_all_bsl(objects)

    print("[dep-analyzer] Building dependency graph...", file=sys.stderr)
    graph = build_graph(objects)
    print(
        f"[dep-analyzer] Graph: {len(graph.objects)} objects, {len(graph.edges)} edges, "
        f"{len(graph.roles)} roles",
        file=sys.stderr,
    )

    target_key = None
    if args.target:
        target_key = find_target_key(graph, args.target)
        if not target_key:
            print(
                f"[WARNING] Target '{args.target}' not found in graph. "
                f"Available objects ({min(20, len(graph.objects))}):",
                file=sys.stderr,
            )
            for i, key in enumerate(sorted(graph.objects.keys())):
                if i >= 20:
                    print(f"  ... and {len(graph.objects) - 20} more", file=sys.stderr)
                    break
                print(f"  {key}", file=sys.stderr)
            sys.exit(1)

    output = _generate_output(
        graph=graph,
        mode=args.mode,
        out_format=args.out_format,
        target=target_key,
        depth=args.depth,
        limit=args.limit,
        offset=args.offset,
    )

    if args.out_file:
        out_path = os.path.abspath(args.out_file)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"[dep-analyzer] Output written to: {out_path}", file=sys.stderr)
    else:
        print(output)

    elapsed = time.time() - t_start
    print(f"[dep-analyzer] Done in {elapsed:.2f}s", file=sys.stderr)


def _generate_output(graph, mode: str, out_format: str,
                     target, depth: int, limit: int, offset: int) -> str:
    """Сгенерировать вывод в зависимости от режима и формата."""
    if mode == "deps":
        from output_deps import format_deps_text, format_deps_json, format_deps_md
        formatters = {"text": format_deps_text, "json": format_deps_json, "md": format_deps_md}
    elif mode == "debug":
        from output_debug import format_debug_text, format_debug_json, format_debug_md
        formatters = {"text": format_debug_text, "json": format_debug_json, "md": format_debug_md}
    elif mode == "rights":
        from output_rights import format_rights_text, format_rights_json, format_rights_md
        formatters = {"text": format_rights_text, "json": format_rights_json, "md": format_rights_md}
    elif mode == "full":
        from output_full import format_full_text, format_full_json, format_full_md
        formatters = {"text": format_full_text, "json": format_full_json, "md": format_full_md}
    else:
        return f"[ERROR] Unknown mode: {mode}"

    formatter = formatters.get(out_format)
    if not formatter:
        return f"[ERROR] Unknown format: {out_format}"

    return formatter(graph, target, depth, limit, offset)


if __name__ == "__main__":
    main()
