#!/usr/bin/env python3
"""dep-analyzer: Анализатор зависимостей, отладки и прав метаданных 1С.

Entry-point с CLI-интерфейсом. Оркестрация: сканирование → парсинг → граф → вывод.
"""
import argparse
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from graph_builder import build_graph, resolve_target_safe, filter_objects, get_object_summary
from output_deps import format_deps
from output_debug import format_debug
from output_rights import format_rights
from output_full import format_full


MODES = ("deps", "debug", "rights", "full", "list")
FORMATS = ("text", "json", "md")


def main():
    parser = argparse.ArgumentParser(
        description="dep-analyzer: Анализатор зависимостей метаданных 1С",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python dep-analyzer.py --config-path /path/to/config --mode deps --target "Document.РеализацияТоваровУслуг"
  python dep-analyzer.py --config-path /path/to/config --mode debug --target "Catalog.Номенклатура" --out-format json
  python dep-analyzer.py --config-path /path/to/config --mode rights --target "Catalog.Контрагенты" --out-format md
  python dep-analyzer.py --config-path /path/to/config --mode full --target "Document.ПоступлениеТоваров" --depth 5
  python dep-analyzer.py --config-path /path/to/config --mode list --target "Catalog"
        """,
    )

    parser.add_argument(
        "--config-path", required=True,
        help="Путь к корню выгрузки конфигурации (содержит Configuration.xml)",
    )
    parser.add_argument(
        "--mode", choices=MODES, default="deps",
        help="Режим анализа: deps | debug | rights | full | list (default: deps)",
    )
    parser.add_argument(
        "--target", default="",
        help="Целевой объект (Document.РеализацияТоваровУслуг) или фильтр для list",
    )
    parser.add_argument(
        "--depth", type=int, default=3,
        help="Глубина обхода графа зависимостей (default: 3)",
    )
    parser.add_argument(
        "--out-format", choices=FORMATS, default="text",
        help="Формат вывода: text | json | md (default: text)",
    )
    parser.add_argument(
        "--limit", type=int, default=150,
        help="Максимальное количество записей в выводе (default: 150)",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Смещение для пагинации (default: 0)",
    )
    parser.add_argument(
        "--out-file", default="",
        help="Путь к файлу для записи результата (по умолчанию — stdout)",
    )
    parser.add_argument(
        "--skip-bsl", action="store_true",
        help="Пропустить анализ BSL-кода (ускоряет работу)",
    )
    parser.add_argument(
        "--skip-roles", action="store_true",
        help="Пропустить парсинг ролей (ускоряет работу)",
    )

    args = parser.parse_args()

    config_path = os.path.abspath(args.config_path)
    if not os.path.isdir(config_path):
        print(f"[ERROR] Configuration path not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    config_xml = os.path.join(config_path, "Configuration.xml")
    if not os.path.exists(config_xml):
        print(f"[ERROR] Configuration.xml not found in: {config_path}", file=sys.stderr)
        sys.exit(1)

    skip_bsl = args.skip_bsl or args.mode == "list"
    skip_roles = args.skip_roles or (args.mode not in ("rights", "full") and args.mode != "list")

    print(f"[INFO] Scanning configuration: {config_path}", file=sys.stderr)
    graph = build_graph(config_path, skip_bsl=skip_bsl, skip_roles=skip_roles)
    print(f"[INFO] Found {len(graph.objects)} objects, {len(graph.edges)} edges", file=sys.stderr)

    output = ""

    if args.mode == "list":
        output = _handle_list(graph, args)
    else:
        if not args.target:
            print("[ERROR] --target is required for mode: " + args.mode, file=sys.stderr)
            sys.exit(1)

        resolved = resolve_target_safe(graph, args.target)
        if not resolved:
            print(f"[ERROR] Object not found: {args.target}", file=sys.stderr)
            _suggest_objects(graph, args.target)
            sys.exit(1)

        print(f"[INFO] Target resolved: {resolved}", file=sys.stderr)

        if args.mode == "deps":
            output = format_deps(graph, resolved, args.depth, args.out_format,
                                 args.limit, args.offset)
        elif args.mode == "debug":
            output = format_debug(graph, resolved, config_path, args.out_format,
                                  args.limit, args.offset)
        elif args.mode == "rights":
            output = format_rights(graph, resolved, args.out_format,
                                   args.limit, args.offset)
        elif args.mode == "full":
            output = format_full(graph, resolved, config_path, args.depth,
                                 args.out_format, args.limit, args.offset)

    if args.out_file:
        with open(args.out_file, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"[INFO] Output written to: {args.out_file}", file=sys.stderr)
    else:
        print(output)


def _handle_list(graph, args) -> str:
    """Обработка режима list — вывод списка объектов."""
    keys = filter_objects(graph, target=args.target, limit=args.limit, offset=args.offset)

    if args.out_format == "json":
        items = []
        for k in keys:
            items.append(get_object_summary(graph, k))
        return json.dumps({"total": len(graph.objects), "objects": items},
                          ensure_ascii=False, indent=2)

    elif args.out_format == "md":
        lines = ["# Объекты конфигурации", ""]
        lines.append(f"**Всего:** {len(graph.objects)}")
        lines.append(f"**Показано:** {len(keys)} (offset={args.offset}, limit={args.limit})")
        lines.append("")
        lines.append("| Тип | Имя | Синоним | Реквизиты | ТЧ |")
        lines.append("|-----|-----|---------|-----------|-----|")
        for k in keys:
            obj = graph.objects[k]
            from xml_helpers import get_type_ru
            type_ru = get_type_ru(obj.obj_type)
            lines.append(
                f"| {type_ru} | {obj.name} | {obj.synonym} | "
                f"{len(obj.attributes)} | {len(obj.tabular_sections)} |"
            )
        return "\n".join(lines)

    else:
        lines = [f"Объекты конфигурации (всего: {len(graph.objects)})"]
        lines.append(f"Показано: {len(keys)} (offset={args.offset}, limit={args.limit})")
        lines.append("")
        for k in keys:
            obj = graph.objects[k]
            from xml_helpers import get_type_ru
            type_ru = get_type_ru(obj.obj_type)
            synonym = f" ({obj.synonym})" if obj.synonym else ""
            lines.append(f"  {type_ru}.{obj.name}{synonym}")
        return "\n".join(lines)


def _suggest_objects(graph, target: str):
    """Предложить похожие объекты."""
    target_lower = target.lower()
    suggestions = []
    for key, obj in graph.objects.items():
        if target_lower in key.lower() or target_lower in obj.name.lower():
            suggestions.append(key)
        if len(suggestions) >= 10:
            break

    if suggestions:
        print("[INFO] Похожие объекты:", file=sys.stderr)
        for s in suggestions:
            print(f"  {s}", file=sys.stderr)


if __name__ == "__main__":
    main()
