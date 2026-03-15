#!/usr/bin/env python3
"""dep-analyzer — анализатор зависимостей, отладки и прав метаданных 1С.

Entry-point: CLI-интерфейс и оркестрация всех модулей.
"""

import argparse
import os
import sys
import time


def main():
    parser = argparse.ArgumentParser(
        description="Анализатор зависимостей, отладки и прав метаданных 1С",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  %(prog)s --config-path ./src/cf --mode deps --target Catalog.Номенклатура
  %(prog)s --config-path ./src/cf --mode debug --target Document.РеализацияТоваровУслуг
  %(prog)s --config-path ./src/cf --mode rights --target Catalog.Номенклатура --format json
  %(prog)s --config-path ./src/cf --mode full --target Catalog.Номенклатура --depth 5
""",
    )
    parser.add_argument(
        "--config-path", required=True,
        help="Путь к корню XML-выгрузки конфигурации 1С",
    )
    parser.add_argument(
        "--mode", default="deps",
        choices=["deps", "debug", "rights", "full"],
        help="Режим анализа (default: deps)",
    )
    parser.add_argument(
        "--target", default="",
        help="Целевой объект: Type.Name или просто Name",
    )
    parser.add_argument(
        "--depth", type=int, default=3,
        help="Глубина обхода графа (default: 3)",
    )
    parser.add_argument(
        "--format", dest="out_format", default="text",
        choices=["text", "json", "md"],
        help="Формат вывода (default: text)",
    )
    parser.add_argument(
        "--limit", type=int, default=150,
        help="Максимум записей в выводе (default: 150)",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Смещение для пагинации (default: 0)",
    )
    parser.add_argument(
        "--out-file", default="",
        help="Файл для записи результата (если не указан — stdout)",
    )

    args = parser.parse_args()

    config_path = os.path.abspath(args.config_path)
    if not os.path.isdir(config_path):
        print(f"[ERROR] Каталог конфигурации не найден: {config_path}", file=sys.stderr)
        sys.exit(1)

    try:
        result = run_analysis(
            config_path=config_path,
            mode=args.mode,
            target=args.target,
            depth=args.depth,
            out_format=args.out_format,
            limit=args.limit,
            offset=args.offset,
        )
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)

    if args.out_file:
        out_path = os.path.abspath(args.out_file)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"[OK] Результат записан в {out_path}", file=sys.stderr)
    else:
        print(result)


def run_analysis(
    config_path: str,
    mode: str = "deps",
    target: str = "",
    depth: int = 3,
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Запустить анализ и вернуть отформатированный результат."""
    from scanner import scan_configuration
    from parser_catalog import parse_catalog
    from parser_document import parse_document
    from parser_register import parse_register
    from parser_misc import parse_misc_object
    from parser_role import parse_role
    from bsl_analyzer import analyze_object_bsl
    from graph_builder import build_graph, get_dependencies, get_debug_points, get_rights_for_object

    t0 = time.time()

    print("[1/5] Сканирование конфигурации...", file=sys.stderr)
    objects = scan_configuration(config_path)
    print(f"  Найдено объектов: {len(objects)}", file=sys.stderr)

    print("[2/5] Парсинг объектов...", file=sys.stderr)
    _TYPE_PARSERS = {
        "Catalog": parse_catalog,
        "Document": parse_document,
        "InformationRegister": parse_register,
        "AccumulationRegister": parse_register,
        "AccountingRegister": parse_register,
        "CalculationRegister": parse_register,
        "Role": parse_role,
    }

    _MISC_TYPES = {
        "EventSubscription", "CommonModule", "Enum", "DataProcessor", "Report",
        "BusinessProcess", "Task", "ExchangePlan", "Constant",
        "ChartOfCharacteristicTypes", "ChartOfAccounts", "ChartOfCalculationTypes",
        "DocumentJournal",
    }

    for key, obj_info in objects.items():
        parser = _TYPE_PARSERS.get(obj_info.obj_type)
        if parser:
            parser(config_path, obj_info)
        elif obj_info.obj_type in _MISC_TYPES:
            parse_misc_object(config_path, obj_info)

    print("[3/5] Анализ BSL-кода...", file=sys.stderr)
    for key, obj_info in objects.items():
        if os.path.isdir(obj_info.path) if obj_info.path else False:
            analyze_object_bsl(config_path, obj_info)

    print("[4/5] Построение графа зависимостей...", file=sys.stderr)
    graph = build_graph(objects)
    print(f"  Рёбер: {len(graph.edges)}, ролей: {len(graph.roles)}", file=sys.stderr)

    print("[5/5] Формирование вывода...", file=sys.stderr)
    result = _format_output(
        graph=graph,
        mode=mode,
        target=target,
        depth=depth,
        out_format=out_format,
        limit=limit,
        offset=offset,
        config_path=config_path,
    )

    elapsed = time.time() - t0
    print(f"[OK] Анализ завершён за {elapsed:.2f}с", file=sys.stderr)

    return result


def _format_output(
    graph,
    mode: str,
    target: str,
    depth: int,
    out_format: str,
    limit: int,
    offset: int,
    config_path: str,
) -> str:
    from graph_builder import get_dependencies, get_debug_points, get_rights_for_object
    from output_deps import format_deps
    from output_debug import format_debug
    from output_rights import format_rights
    from output_full import format_full

    resolved_target = _resolve_target(graph, target)

    if mode == "deps":
        edges = get_dependencies(graph, resolved_target, depth=depth, direction="both")
        return format_deps(graph, resolved_target, edges, out_format, limit, offset)

    elif mode == "debug":
        debug_points = get_debug_points(graph, resolved_target, config_path)
        return format_debug(graph, resolved_target, debug_points, out_format, limit, offset)

    elif mode == "rights":
        rights = get_rights_for_object(graph, resolved_target)
        return format_rights(graph, resolved_target, rights, out_format, limit, offset)

    elif mode == "full":
        edges = get_dependencies(graph, resolved_target, depth=depth, direction="both")
        debug_points = get_debug_points(graph, resolved_target, config_path)
        rights = get_rights_for_object(graph, resolved_target)
        return format_full(graph, resolved_target, edges, debug_points, rights, out_format, limit, offset)

    else:
        return f"[ERROR] Неизвестный режим: {mode}"


def _resolve_target(graph, target: str) -> str:
    """Разрешить имя объекта в полный ключ графа."""
    if not target:
        return ""

    if target in graph.objects:
        return target

    for key in graph.objects:
        if key.endswith(f".{target}"):
            return key

    target_lower = target.lower()
    for key in graph.objects:
        if key.lower() == target_lower or key.lower().endswith(f".{target_lower}"):
            return key

    return target


if __name__ == "__main__":
    main()
