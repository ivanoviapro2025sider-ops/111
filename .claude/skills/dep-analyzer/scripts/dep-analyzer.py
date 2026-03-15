#!/usr/bin/env python3
"""dep-analyzer — Анализатор зависимостей, отладки и прав метаданных 1С.

Entry-point: CLI-оркестрация. Сканирует конфигурацию, запускает парсеры,
строит граф зависимостей и выводит результат в нужном формате.

Usage:
    python dep-analyzer.py --config-path /path/to/config --mode deps --target "Document.РеализацияТоваровУслуг" --depth 3 --format text
"""

import argparse
import os
import sys
import time


def _setup_path():
    """Ensure script directory is on sys.path for local imports."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)


_setup_path()

from models import DependencyGraph
from scanner import scan_configuration
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_register import parse_registers
from parser_misc import parse_misc_objects
from parser_role import parse_roles
from bsl_analyzer import analyze_bsl
from graph_builder import build_full_graph
from output_deps import format_deps
from output_debug import format_debug
from output_rights import format_rights
from output_full import format_full


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Анализатор зависимостей метаданных 1С",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  %(prog)s --config-path ./MyConfig --mode deps --target "Document.РеализацияТоваровУслуг"
  %(prog)s --config-path ./MyConfig --mode debug --target "Document.*" --depth 2
  %(prog)s --config-path ./MyConfig --mode rights --target "Catalog.Номенклатура" --format json
  %(prog)s --config-path ./MyConfig --mode full --target "Document.РеализацияТоваровУслуг" --format md
        """,
    )

    parser.add_argument(
        "--config-path", required=True,
        help="Путь к каталогу выгрузки конфигурации 1С (содержит Configuration.xml)",
    )
    parser.add_argument(
        "--mode", default="deps",
        choices=["deps", "debug", "rights", "full"],
        help="Режим работы: deps (зависимости), debug (точки отладки), "
             "rights (аудит прав), full (всё вместе). По умолчанию: deps",
    )
    parser.add_argument(
        "--target", default="",
        help="Целевой объект: 'Document.РеализацияТоваровУслуг', 'Catalog.*', '*.Номенклатура'. "
             "Пустая строка = все объекты (с ограничением --limit)",
    )
    parser.add_argument(
        "--depth", type=int, default=3,
        help="Глубина обхода графа зависимостей (по умолчанию: 3)",
    )
    parser.add_argument(
        "--format", dest="out_format", default="text",
        choices=["text", "json", "md"],
        help="Формат вывода: text, json, md (markdown). По умолчанию: text",
    )
    parser.add_argument(
        "--limit", type=int, default=150,
        help="Максимальное количество записей в выводе (по умолчанию: 150)",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Смещение для пагинации вывода (по умолчанию: 0)",
    )
    parser.add_argument(
        "--out-file", default="",
        help="Путь к файлу для сохранения результата (если пусто — stdout)",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Подробный вывод с информацией о ходе анализа",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    config_path = os.path.abspath(args.config_path)
    if not os.path.isdir(config_path):
        print(f"[ERROR] Каталог конфигурации не найден: {config_path}", file=sys.stderr)
        sys.exit(1)

    t_start = time.time()

    if args.verbose:
        print(f"[INFO] Сканирование конфигурации: {config_path}", file=sys.stderr)
    graph = scan_configuration(config_path)

    obj_count = len(graph.objects)
    if args.verbose:
        print(f"[INFO] Найдено объектов: {obj_count}", file=sys.stderr)

    if obj_count == 0:
        print("[WARNING] Объекты метаданных не найдены. Проверьте путь к конфигурации.",
              file=sys.stderr)

    if args.verbose:
        print("[INFO] Парсинг справочников...", file=sys.stderr)
    parse_catalogs(graph, config_path)

    if args.verbose:
        print("[INFO] Парсинг документов...", file=sys.stderr)
    parse_documents(graph, config_path)

    if args.verbose:
        print("[INFO] Парсинг регистров...", file=sys.stderr)
    parse_registers(graph, config_path)

    if args.verbose:
        print("[INFO] Парсинг прочих объектов...", file=sys.stderr)
    parse_misc_objects(graph, config_path)

    if args.verbose:
        print("[INFO] Парсинг ролей...", file=sys.stderr)
    parse_roles(graph, config_path)

    if args.verbose:
        print("[INFO] Анализ BSL-кода...", file=sys.stderr)
    analyze_bsl(graph, config_path)

    if args.verbose:
        print("[INFO] Построение графа...", file=sys.stderr)
    build_full_graph(graph)

    t_parse = time.time()
    if args.verbose:
        print(f"[INFO] Парсинг завершён за {t_parse - t_start:.2f}с. "
              f"Объектов: {len(graph.objects)}, рёбер: {len(graph.edges)}, "
              f"ролей: {len(graph.roles)}", file=sys.stderr)

    if args.verbose:
        print(f"[INFO] Формирование вывода: mode={args.mode}, format={args.out_format}",
              file=sys.stderr)

    output = _generate_output(graph, args, config_path)

    if args.out_file:
        out_path = os.path.abspath(args.out_file)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(output)
        if args.verbose:
            print(f"[INFO] Результат сохранён в {out_path}", file=sys.stderr)
    else:
        print(output)

    t_end = time.time()
    if args.verbose:
        print(f"[INFO] Общее время: {t_end - t_start:.2f}с", file=sys.stderr)


def _generate_output(graph: DependencyGraph, args: argparse.Namespace,
                     config_path: str) -> str:
    """Route to appropriate output formatter."""
    target = args.target
    depth = args.depth
    fmt = args.out_format
    limit = args.limit
    offset = args.offset

    if args.mode == "deps":
        return format_deps(graph, target, depth, fmt, limit, offset)
    elif args.mode == "debug":
        return format_debug(graph, target, depth, fmt, limit, offset, config_path)
    elif args.mode == "rights":
        return format_rights(graph, target, depth, fmt, limit, offset)
    elif args.mode == "full":
        return format_full(graph, target, depth, fmt, limit, offset, config_path)
    else:
        return f"[ERROR] Неизвестный режим: {args.mode}"


if __name__ == "__main__":
    main()
