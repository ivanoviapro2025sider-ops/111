"""Вывод: режим deps (text/json/md) — зависимости объекта."""

import json
from typing import List, Tuple, Optional

from models import DependencyGraph, Edge, EdgeKind
from xml_helpers import get_type_ru


def format_deps(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    out_format: str = "text",
    limit: int = 150,
    offset: int = 0,
) -> str:
    """Форматировать результат анализа зависимостей."""
    if out_format == "json":
        return _format_deps_json(graph, target, edges_with_levels, limit, offset)
    elif out_format == "md":
        return _format_deps_md(graph, target, edges_with_levels, limit, offset)
    else:
        return _format_deps_text(graph, target, edges_with_levels, limit, offset)


def _format_deps_text(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"=== Зависимости: {obj_type_ru} «{obj_name}» ({target}) ===")
    lines.append("")

    total = len(edges_with_levels)
    sliced = edges_with_levels[offset:offset + limit]

    if not sliced:
        lines.append("  (зависимости не найдены)")
    else:
        current_level = 0
        for edge, level in sliced:
            if level != current_level:
                current_level = level
                lines.append(f"  --- Уровень {level} ---")

            indent = "  " * level
            direction = "→" if edge.source == target else "←"
            other = edge.target if edge.source == target else edge.source

            other_obj = graph.objects.get(other)
            other_name = other_obj.name if other_obj else other
            other_type_ru = get_type_ru(other_obj.obj_type) if other_obj else ""

            kind_ru = _edge_kind_ru(edge.kind)
            meta_str = _format_meta(edge.meta)

            lines.append(f"{indent}{direction} {other_type_ru} «{other_name}» [{kind_ru}]{meta_str}")

    lines.append("")
    lines.append(f"Всего: {total} связей (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)


def _format_deps_json(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    limit: int,
    offset: int,
) -> str:
    total = len(edges_with_levels)
    sliced = edges_with_levels[offset:offset + limit]

    obj = graph.objects.get(target)
    result = {
        "target": target,
        "target_name": obj.name if obj else target,
        "target_type": obj.obj_type if obj else "",
        "total": total,
        "offset": offset,
        "limit": limit,
        "edges": [],
    }

    for edge, level in sliced:
        result["edges"].append({
            "source": edge.source,
            "target": edge.target,
            "kind": edge.kind.value,
            "level": level,
            "meta": edge.meta,
        })

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_deps_md(
    graph: DependencyGraph,
    target: str,
    edges_with_levels: List[Tuple[Edge, int]],
    limit: int,
    offset: int,
) -> str:
    lines = []
    obj = graph.objects.get(target)
    obj_name = obj.name if obj else target
    obj_type_ru = get_type_ru(obj.obj_type) if obj else ""

    lines.append(f"# Зависимости: {obj_type_ru} «{obj_name}»")
    lines.append("")

    total = len(edges_with_levels)
    sliced = edges_with_levels[offset:offset + limit]

    if not sliced:
        lines.append("_Зависимости не найдены._")
    else:
        lines.append("| Уровень | Направление | Объект | Тип связи | Детали |")
        lines.append("|---------|------------|--------|-----------|--------|")

        for edge, level in sliced:
            direction = "→" if edge.source == target else "←"
            other = edge.target if edge.source == target else edge.source

            other_obj = graph.objects.get(other)
            other_name = other_obj.name if other_obj else other
            other_type_ru = get_type_ru(other_obj.obj_type) if other_obj else ""

            kind_ru = _edge_kind_ru(edge.kind)
            meta_str = _format_meta_short(edge.meta)

            lines.append(
                f"| {level} | {direction} | {other_type_ru} «{other_name}» | {kind_ru} | {meta_str} |"
            )

    lines.append("")
    lines.append(f"**Всего:** {total} связей (показано {len(sliced)}, offset={offset})")

    return "\n".join(lines)


def _edge_kind_ru(kind: EdgeKind) -> str:
    mapping = {
        EdgeKind.DOC_TO_REGISTER: "Движение",
        EdgeKind.DOC_TO_CATALOG: "Ссылка на справочник",
        EdgeKind.DOC_TO_DOCUMENT: "Ссылка на документ",
        EdgeKind.CATALOG_TO_CATALOG: "Ссылка (спр→спр)",
        EdgeKind.CATALOG_TO_DOCUMENT: "Ссылка на документ",
        EdgeKind.REGISTER_TO_DOCUMENT: "Регистратор",
        EdgeKind.REGISTER_TO_CATALOG: "Измерение/ресурс",
        EdgeKind.REGISTER_TO_REGISTER: "Ссылка (рег→рег)",
        EdgeKind.SUBSCRIPTION_TO_OBJECT: "Подписка→объект",
        EdgeKind.SUBSCRIPTION_TO_MODULE: "Подписка→модуль",
        EdgeKind.BSL_CALL: "Вызов BSL",
        EdgeKind.BSL_META_ACCESS: "Обращение к метаданным",
        EdgeKind.BSL_QUERY_REF: "Ссылка в запросе",
        EdgeKind.BASED_ON: "Ввод на основании",
        EdgeKind.OWNER: "Владелец",
        EdgeKind.HIERARCHY: "Иерархия",
    }
    return mapping.get(kind, kind.value)


def _format_meta(meta: dict) -> str:
    if not meta:
        return ""
    parts = []
    if "attribute" in meta:
        parts.append(f"реквизит: {meta['attribute']}")
    if "tabular_section" in meta:
        parts.append(f"ТЧ: {meta['tabular_section']}")
    if "register" in meta:
        parts.append(f"регистр: {meta['register']}")
    if "method" in meta and meta["method"]:
        parts.append(f"метод: {meta['method']}")
    if "handler" in meta:
        parts.append(f"обработчик: {meta['handler']}")
    if "event" in meta:
        parts.append(f"событие: {meta['event']}")
    if "line" in meta and meta["line"] != "0":
        parts.append(f"строка: {meta['line']}")
    if parts:
        return " (" + ", ".join(parts) + ")"
    return ""


def _format_meta_short(meta: dict) -> str:
    if not meta:
        return ""
    parts = []
    if "attribute" in meta:
        parts.append(meta["attribute"])
    if "tabular_section" in meta:
        parts.append(f"ТЧ:{meta['tabular_section']}")
    if "method" in meta and meta["method"]:
        parts.append(meta["method"])
    return ", ".join(parts)
