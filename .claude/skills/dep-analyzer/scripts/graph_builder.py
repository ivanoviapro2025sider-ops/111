"""Построение графа зависимостей и рекурсивный обход по Depth."""

from typing import List, Optional, Set, Tuple, Dict

from models import (
    DependencyGraph, ObjectInfo, Edge, EdgeKind, DebugPoint,
)
from xml_helpers import get_full_object_key, split_object_key


def build_full_graph(graph: DependencyGraph):
    """Post-process: deduplicate edges, validate references."""
    _deduplicate_edges(graph)
    _validate_edges(graph)


def _deduplicate_edges(graph: DependencyGraph):
    """Remove duplicate edges (same source, target, kind)."""
    seen = set()
    unique_edges = []

    for edge in graph.edges:
        key = (edge.source, edge.target, edge.kind)
        if key not in seen:
            seen.add(key)
            unique_edges.append(edge)

    graph.edges = unique_edges

    graph._edges_by_source.clear()
    graph._edges_by_target.clear()
    graph._edges_by_kind.clear()

    for edge in graph.edges:
        graph._edges_by_source[edge.source].append(edge)
        graph._edges_by_target[edge.target].append(edge)
        graph._edges_by_kind[edge.kind].append(edge)


def _validate_edges(graph: DependencyGraph):
    """Mark edges whose target doesn't exist in the graph."""
    for edge in graph.edges:
        if edge.target not in graph.objects:
            edge.meta["unresolved"] = "true"


def get_dependencies(graph: DependencyGraph, target: str, depth: int,
                     direction: str = "both") -> List[Tuple[Edge, int]]:
    """Get all dependencies for a target object up to given depth.

    Args:
        graph: The dependency graph
        target: Object key like 'Document.РеализацияТоваровУслуг'
        depth: Maximum traversal depth
        direction: 'outgoing', 'incoming', or 'both'

    Returns:
        List of (Edge, level) tuples
    """
    return graph.traverse(target, depth, direction)


def get_dependency_tree(graph: DependencyGraph, target: str, depth: int,
                        direction: str = "both") -> Dict:
    """Build a tree structure of dependencies.

    Returns a nested dict:
    {
        'object': 'Document.РеализацияТоваровУслуг',
        'info': ObjectInfo,
        'children': [
            {
                'object': 'AccumulationRegister.ТоварыНаСкладах',
                'edge_kind': 'doc_to_register',
                'level': 1,
                'info': ObjectInfo,
                'children': [...]
            }
        ]
    }
    """
    obj_info = graph.objects.get(target)
    tree = {
        "object": target,
        "info": obj_info,
        "children": [],
    }

    if depth <= 0:
        return tree

    visited: Set[str] = {target}
    _build_tree_recursive(graph, target, depth, 1, direction, visited, tree["children"])

    return tree


def _build_tree_recursive(graph: DependencyGraph, current: str, max_depth: int,
                          current_depth: int, direction: str,
                          visited: Set[str], children: list):
    """Recursively build dependency tree."""
    if current_depth > max_depth:
        return

    edges: List[Edge] = []
    if direction in ("outgoing", "both"):
        edges += graph.get_edges_from(current)
    if direction in ("incoming", "both"):
        edges += graph.get_edges_to(current)

    for edge in edges:
        next_node = edge.target if edge.source == current else edge.source
        if next_node in visited:
            continue

        visited.add(next_node)
        obj_info = graph.objects.get(next_node)
        child = {
            "object": next_node,
            "edge_kind": edge.kind.value,
            "level": current_depth,
            "info": obj_info,
            "children": [],
        }

        if current_depth < max_depth:
            _build_tree_recursive(
                graph, next_node, max_depth,
                current_depth + 1, direction,
                visited, child["children"],
            )

        children.append(child)


def find_objects_by_pattern(graph: DependencyGraph, pattern: str) -> List[str]:
    """Find object keys matching a pattern.

    Supports:
    - Exact match: 'Document.РеализацияТоваровУслуг'
    - Type filter: 'Document.*'
    - Name search: '*.Номенклатура'
    - Partial name: '*Товар*'
    """
    if not pattern:
        return list(graph.objects.keys())

    if pattern in graph.objects:
        return [pattern]

    results = []

    if "." in pattern:
        type_part, name_part = pattern.split(".", 1)

        for key in graph.objects:
            obj_type, obj_name = split_object_key(key)
            type_match = (type_part == "*" or obj_type == type_part)
            name_match = _wildcard_match(obj_name, name_part)
            if type_match and name_match:
                results.append(key)
    else:
        for key in graph.objects:
            obj_type, obj_name = split_object_key(key)
            if _wildcard_match(obj_name, pattern) or _wildcard_match(key, pattern):
                results.append(key)

    return sorted(results)


def _wildcard_match(text: str, pattern: str) -> bool:
    """Simple wildcard matching with '*'."""
    if pattern == "*":
        return True
    if "*" not in pattern:
        return text == pattern

    parts = pattern.split("*")
    if len(parts) == 2:
        prefix, suffix = parts
        if prefix and suffix:
            return text.startswith(prefix) and text.endswith(suffix)
        elif prefix:
            return text.startswith(prefix)
        elif suffix:
            return text.endswith(suffix)
        return True

    pos = 0
    for i, part in enumerate(parts):
        if not part:
            continue
        idx = text.find(part, pos)
        if idx < 0:
            return False
        if i == 0 and not pattern.startswith("*"):
            if idx != 0:
                return False
        pos = idx + len(part)

    if not pattern.endswith("*") and parts[-1]:
        return text.endswith(parts[-1])

    return True


def get_impact_analysis(graph: DependencyGraph, target: str,
                        depth: int) -> Dict[str, List[str]]:
    """Analyze what objects are impacted if target changes.

    Returns dict grouped by impact type:
    {
        'direct_dependents': [...],
        'register_movements': [...],
        'bsl_callers': [...],
        'rights_affected': [...],
    }
    """
    result = {
        "direct_dependents": [],
        "register_movements": [],
        "bsl_callers": [],
        "rights_affected": [],
    }

    incoming = graph.get_edges_to(target)
    for edge in incoming:
        if edge.kind in (EdgeKind.BSL_CALL, EdgeKind.BSL_META_ACCESS, EdgeKind.BSL_QUERY_REF):
            if edge.source not in result["bsl_callers"]:
                result["bsl_callers"].append(edge.source)
        elif edge.kind in (EdgeKind.DOC_TO_REGISTER, EdgeKind.REGISTER_TO_DOCUMENT):
            if edge.source not in result["register_movements"]:
                result["register_movements"].append(edge.source)
        else:
            if edge.source not in result["direct_dependents"]:
                result["direct_dependents"].append(edge.source)

    for role_name, role_info in graph.roles.items():
        for obj_rights in role_info.object_rights:
            if target in obj_rights.object_name or obj_rights.object_name.endswith(target):
                role_key = f"Role.{role_name}"
                if role_key not in result["rights_affected"]:
                    result["rights_affected"].append(role_key)

    if depth > 1:
        all_deps = set()
        for lst in result.values():
            all_deps.update(lst)

        for dep in list(all_deps):
            sub_result = get_impact_analysis(graph, dep, depth - 1)
            for category, items in sub_result.items():
                for item in items:
                    if item not in result[category] and item != target:
                        result[category].append(item)

    return result
