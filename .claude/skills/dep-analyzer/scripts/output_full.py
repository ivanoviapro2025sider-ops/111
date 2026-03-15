"""Вывод: режим full — сборка всех выводов (deps + debug + rights)."""
import json
from typing import Optional

from models import DependencyGraph, ObjectInfo
from xml_helpers import get_type_ru
from output_deps import format_deps
from output_debug import format_debug
from output_rights import format_rights


def format_full(graph: DependencyGraph, target: str, config_path: str,
                depth: int = 3, out_format: str = "text",
                limit: int = 150, offset: int = 0) -> str:
    """Полный вывод: зависимости + отладка + права.

    target: ключ объекта в графе
    config_path: корень конфигурации
    depth: глубина обхода зависимостей
    out_format: 'text' | 'json' | 'md'
    """
    if out_format == "json":
        return _format_full_json(graph, target, config_path, depth, limit, offset)
    elif out_format == "md":
        return _format_full_md(graph, target, config_path, depth, limit, offset)
    else:
        return _format_full_text(graph, target, config_path, depth, limit, offset)


def _format_full_text(graph: DependencyGraph, target: str, config_path: str,
                      depth: int, limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append("=" * 60)
    lines.append(f"  ПОЛНЫЙ АНАЛИЗ: {label}")
    lines.append("=" * 60)
    lines.append("")

    _append_object_info(lines, obj, target)
    lines.append("")

    deps_text = format_deps(graph, target, depth, "text", limit, offset)
    lines.append(deps_text)
    lines.append("")
    lines.append("-" * 60)
    lines.append("")

    debug_text = format_debug(graph, target, config_path, "text", limit, offset)
    lines.append(debug_text)
    lines.append("")
    lines.append("-" * 60)
    lines.append("")

    rights_text = format_rights(graph, target, "text", limit, offset)
    lines.append(rights_text)

    return "\n".join(lines)


def _format_full_json(graph: DependencyGraph, target: str, config_path: str,
                      depth: int, limit: int, offset: int) -> str:
    deps_json = json.loads(format_deps(graph, target, depth, "json", limit, offset))
    debug_json = json.loads(format_debug(graph, target, config_path, "json", limit, offset))
    rights_json = json.loads(format_rights(graph, target, "json", limit, offset))

    obj = graph.objects.get(target)

    result = {
        "target": target,
        "type": obj.obj_type if obj else "",
        "name": obj.name if obj else "",
        "synonym": obj.synonym if obj else "",
    }

    if obj:
        result["info"] = _build_object_info(obj)

    result["dependencies"] = deps_json
    result["debug"] = debug_json
    result["rights"] = rights_json

    return json.dumps(result, ensure_ascii=False, indent=2)


def _format_full_md(graph: DependencyGraph, target: str, config_path: str,
                    depth: int, limit: int, offset: int) -> str:
    lines = []
    obj = graph.objects.get(target)
    type_ru = get_type_ru(obj.obj_type) if obj else ""
    label = f"{type_ru}.{obj.name}" if obj else target

    lines.append(f"# Полный анализ: {label}")
    lines.append("")

    if obj:
        lines.append("## Информация об объекте")
        lines.append("")
        lines.append(f"- **Тип:** {type_ru} ({obj.obj_type})")
        lines.append(f"- **Имя:** {obj.name}")
        if obj.synonym:
            lines.append(f"- **Синоним:** {obj.synonym}")
        if obj.comment:
            lines.append(f"- **Комментарий:** {obj.comment}")
        lines.append(f"- **Реквизиты:** {len(obj.attributes)}")
        lines.append(f"- **Табличные части:** {len(obj.tabular_sections)}")
        lines.append(f"- **Процедуры/функции:** {len(obj.procedures)}")
        lines.append("")
        lines.append("---")
        lines.append("")

    deps_md = format_deps(graph, target, depth, "md", limit, offset)
    lines.append(deps_md)
    lines.append("")
    lines.append("---")
    lines.append("")

    debug_md = format_debug(graph, target, config_path, "md", limit, offset)
    lines.append(debug_md)
    lines.append("")
    lines.append("---")
    lines.append("")

    rights_md = format_rights(graph, target, "md", limit, offset)
    lines.append(rights_md)

    return "\n".join(lines)


def _append_object_info(lines: list, obj: Optional[ObjectInfo], target: str):
    """Добавить блок информации об объекте (text-формат)."""
    if not obj:
        lines.append(f"Объект: {target}")
        return

    type_ru = get_type_ru(obj.obj_type)
    lines.append(f"Тип:        {type_ru} ({obj.obj_type})")
    lines.append(f"Имя:        {obj.name}")
    if obj.synonym:
        lines.append(f"Синоним:    {obj.synonym}")
    if obj.comment:
        lines.append(f"Комментарий: {obj.comment}")
    lines.append(f"Реквизиты:  {len(obj.attributes)}")
    lines.append(f"Таб. части: {len(obj.tabular_sections)}")
    lines.append(f"Процедуры:  {len(obj.procedures)}")

    if obj.obj_type == "Document" and obj.movement_registers:
        lines.append(f"Движения:   {', '.join(obj.movement_registers)}")
    if obj.based_on:
        lines.append(f"На основании: {', '.join(obj.based_on)}")


def _build_object_info(obj: ObjectInfo) -> dict:
    """Построить dict с информацией об объекте."""
    info = {
        "type_ru": get_type_ru(obj.obj_type),
        "attributes_count": len(obj.attributes),
        "tabular_sections_count": len(obj.tabular_sections),
        "procedures_count": len(obj.procedures),
        "references_count": len(obj.references),
    }
    if obj.obj_type == "Document":
        info["movement_registers"] = obj.movement_registers
        info["based_on"] = obj.based_on
    if obj.forms:
        info["forms"] = obj.forms
    if obj.templates:
        info["templates"] = obj.templates
    return info
