"""Вывод: режим full — сборка всех выводов (deps + debug + rights)."""

import json
from typing import Optional

from models import DependencyGraph
from output_deps import format_deps_text, format_deps_json, format_deps_md
from output_debug import format_debug_text, format_debug_json, format_debug_md
from output_rights import format_rights_text, format_rights_json, format_rights_md


def format_full_text(graph: DependencyGraph, target: Optional[str] = None,
                     depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Полный вывод в текстовом формате: deps + debug + rights."""
    sections = []

    section_limit = max(limit // 3, 10)

    sections.append(format_deps_text(graph, target, depth, section_limit, offset))
    sections.append("")
    sections.append(format_debug_text(graph, target, depth, section_limit, offset))
    sections.append("")
    sections.append(format_rights_text(graph, target, depth, section_limit, offset))

    header = "=" * 60
    result = [header]
    if target:
        result.append(f"  ПОЛНЫЙ АНАЛИЗ: {target}")
    else:
        result.append("  ПОЛНЫЙ АНАЛИЗ КОНФИГУРАЦИИ")
    result.append(f"  Глубина: {depth}")
    result.append(header)
    result.append("")
    result.extend(sections)
    result.append("")
    result.append(header)
    result.append(f"  Объектов в графе: {len(graph.objects)}")
    result.append(f"  Связей в графе: {len(graph.edges)}")
    result.append(f"  Ролей: {len(graph.roles)}")
    result.append(header)

    return "\n".join(result)


def format_full_json(graph: DependencyGraph, target: Optional[str] = None,
                     depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Полный вывод в JSON: объединение deps + debug + rights."""
    deps_data = json.loads(format_deps_json(graph, target, depth, limit, offset))
    debug_data = json.loads(format_debug_json(graph, target, depth, limit, offset))
    rights_data = json.loads(format_rights_json(graph, target, depth, limit, offset))

    full_data = {
        "mode": "full",
        "target": target,
        "depth": depth,
        "summary": {
            "objects_count": len(graph.objects),
            "edges_count": len(graph.edges),
            "roles_count": len(graph.roles),
        },
        "deps": deps_data,
        "debug": debug_data,
        "rights": rights_data,
    }

    return json.dumps(full_data, ensure_ascii=False, indent=2)


def format_full_md(graph: DependencyGraph, target: Optional[str] = None,
                   depth: int = 3, limit: int = 150, offset: int = 0) -> str:
    """Полный вывод в Markdown: сборка всех секций."""
    lines = []

    if target:
        obj = graph.objects.get(target)
        if obj:
            from xml_helpers import get_type_ru
            type_ru = get_type_ru(obj.obj_type)
            label = f"{type_ru} \"{obj.name}\""
            if obj.synonym:
                label += f" ({obj.synonym})"
            lines.append(f"# Полный анализ: {label}\n")
        else:
            lines.append(f"# Полный анализ: {target}\n")
    else:
        lines.append("# Полный анализ конфигурации\n")

    lines.append(f"| Параметр | Значение |")
    lines.append(f"|----------|----------|")
    lines.append(f"| Объектов | {len(graph.objects)} |")
    lines.append(f"| Связей | {len(graph.edges)} |")
    lines.append(f"| Ролей | {len(graph.roles)} |")
    if target:
        lines.append(f"| Цель | `{target}` |")
    lines.append(f"| Глубина | {depth} |")
    lines.append("")

    lines.append("---\n")

    section_limit = max(limit // 3, 10)

    deps_md = format_deps_md(graph, target, depth, section_limit, offset)
    deps_md = _demote_headers(deps_md)
    lines.append(deps_md)
    lines.append("\n---\n")

    debug_md = format_debug_md(graph, target, depth, section_limit, offset)
    debug_md = _demote_headers(debug_md)
    lines.append(debug_md)
    lines.append("\n---\n")

    rights_md = format_rights_md(graph, target, depth, section_limit, offset)
    rights_md = _demote_headers(rights_md)
    lines.append(rights_md)

    return "\n".join(lines)


def _demote_headers(md_text: str) -> str:
    """Понизить уровень заголовков Markdown на один (# → ##, ## → ### и т.д.)."""
    lines = md_text.split("\n")
    result = []
    for line in lines:
        if line.startswith("#"):
            result.append("#" + line)
        else:
            result.append(line)
    return "\n".join(result)
