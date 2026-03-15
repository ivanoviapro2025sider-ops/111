"""Построение графа зависимостей + рекурсивный обход по Depth."""
import os
from typing import List, Optional, Set, Tuple, Dict

from models import (
    DependencyGraph, ObjectInfo, Edge, EdgeKind,
)
from xml_helpers import get_full_object_key, get_type_ru
from scanner import scan_configuration
from parser_catalog import parse_catalogs
from parser_document import parse_documents
from parser_register import parse_registers
from parser_misc import parse_misc_objects
from parser_role import parse_roles
from bsl_analyzer import analyze_bsl


def build_graph(config_path: str, skip_bsl: bool = False,
                skip_roles: bool = False) -> DependencyGraph:
    """Полная сборка графа зависимостей конфигурации.

    1. Сканирование Configuration.xml → индекс объектов
    2. Парсинг всех типов объектов → заполнение ObjectInfo + рёбра
    3. Анализ BSL-кода (опционально)
    4. Парсинг ролей (опционально)
    """
    graph = scan_configuration(config_path)

    parse_catalogs(graph, config_path)
    parse_documents(graph, config_path)
    parse_registers(graph, config_path)
    parse_misc_objects(graph, config_path)

    if not skip_roles:
        parse_roles(graph, config_path)

    if not skip_bsl:
        analyze_bsl(graph, config_path)

    return graph


def get_dependencies(graph: DependencyGraph, target: str, depth: int = 3,
                     direction: str = "both") -> List[Tuple[Edge, int]]:
    """Получить зависимости объекта с рекурсивным обходом до указанной глубины.

    target: ключ объекта ("Document.РеализацияТоваровУслуг")
    depth: глубина обхода
    direction: 'outgoing' | 'incoming' | 'both'
    """
    return graph.traverse(target, depth, direction)


def resolve_target(graph: DependencyGraph, target_str: str) -> Optional[str]:
    """Разрешить строку target в ключ графа.

    Поддерживает форматы:
    - "Catalog.Номенклатура" → прямой ключ
    - "Справочник.Номенклатура" → поиск по русскому типу
    - "Номенклатура" → поиск по имени (первое совпадение)
    """
    if not target_str:
        return None

    if target_str in graph.objects:
        return target_str

    parts = target_str.split(".", 1)
    if len(parts) == 2:
        ru_type = parts[0]
        name = parts[1]
        ru_to_en = _build_ru_to_en()
        for ru_name, eng_type in ru_to_en.items():
            if ru_name == ru_type:
                key = get_full_object_key(eng_type, name)
                if key in graph.objects:
                    return key

    for key in graph.objects:
        if key.endswith(f".{target_str}"):
            return key

    for key, obj in graph.objects.items():
        if obj.name == target_str:
            return key

    target_lower = target_str.lower()
    for key, obj in graph.objects.items():
        if obj.name.lower() == target_lower:
            return key

    return None


def _build_ru_to_en() -> Dict[str, str]:
    """Построить маппинг русских типов → английские."""
    from xml_helpers import TYPE_TO_RU
    return {v: k for k, v in TYPE_TO_RU.items()}


_RU_TO_EN: Dict[str, str] = {}


def _ensure_ru_to_en():
    global _RU_TO_EN
    if not _RU_TO_EN:
        _RU_TO_EN = _build_ru_to_en()


def resolve_target_safe(graph: DependencyGraph, target_str: str) -> Optional[str]:
    """resolve_target с предварительной инициализацией маппинга."""
    _ensure_ru_to_en()
    return _resolve_target_impl(graph, target_str)


def _resolve_target_impl(graph: DependencyGraph, target_str: str) -> Optional[str]:
    if not target_str:
        return None

    if target_str in graph.objects:
        return target_str

    parts = target_str.split(".", 1)
    if len(parts) == 2:
        ru_type = parts[0]
        name = parts[1]
        for ru_name, eng_type in _RU_TO_EN.items():
            if ru_name == ru_type:
                key = get_full_object_key(eng_type, name)
                if key in graph.objects:
                    return key

    for key in graph.objects:
        if key.endswith(f".{target_str}"):
            return key

    for key, obj in graph.objects.items():
        if obj.name == target_str:
            return key

    target_lower = target_str.lower()
    for key, obj in graph.objects.items():
        if obj.name.lower() == target_lower:
            return key

    return None


def filter_objects(graph: DependencyGraph, target: str = "",
                   obj_type: str = "", limit: int = 150,
                   offset: int = 0) -> List[str]:
    """Фильтрация объектов графа по шаблону/типу с пагинацией."""
    keys = list(graph.objects.keys())

    if obj_type:
        keys = [k for k in keys if graph.objects[k].obj_type == obj_type]

    if target:
        target_lower = target.lower()
        keys = [k for k in keys if target_lower in k.lower()
                or target_lower in graph.objects[k].name.lower()
                or (graph.objects[k].synonym and target_lower in graph.objects[k].synonym.lower())]

    keys.sort()
    return keys[offset:offset + limit]


def get_object_summary(graph: DependencyGraph, key: str) -> Dict:
    """Краткая сводка по объекту."""
    obj = graph.objects.get(key)
    if not obj:
        return {"error": f"Object not found: {key}"}

    return {
        "key": key,
        "type": obj.obj_type,
        "name": obj.name,
        "synonym": obj.synonym,
        "attributes_count": len(obj.attributes),
        "tabular_sections_count": len(obj.tabular_sections),
        "references_count": len(obj.references),
        "procedures_count": len(obj.procedures),
        "edges_from": len(graph.get_edges_from(key)),
        "edges_to": len(graph.get_edges_to(key)),
    }
