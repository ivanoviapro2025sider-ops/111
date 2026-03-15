"""Парсер справочников (Catalog) — извлечение реквизитов, табличных частей, владельцев, иерархии."""

import os
from typing import List

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, get_xml_text, get_xml_elements,
    parse_types_from_element, get_full_object_key,
    NSMAP, NS_MD,
)
from scanner import get_object_xml_path


def parse_catalogs(graph: DependencyGraph, config_path: str):
    """Parse all Catalog objects in the graph."""
    catalogs = graph.get_objects_by_type("Catalog")
    for obj in catalogs:
        _parse_single_catalog(obj, graph, config_path)


def _parse_single_catalog(obj: ObjectInfo, graph: DependencyGraph, config_path: str):
    """Parse a single catalog XML and populate ObjectInfo."""
    xml_path = get_object_xml_path(obj)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    _parse_catalog_properties(obj, root)
    _parse_catalog_attributes(obj, root, graph)
    _parse_catalog_tabular_sections(obj, root, graph)
    _parse_catalog_owners(obj, root, graph)
    _parse_catalog_hierarchy(obj, root, graph)
    _parse_catalog_forms(obj, root)
    _parse_catalog_commands(obj, root)
    _parse_catalog_templates(obj, root)


def _parse_catalog_properties(obj: ObjectInfo, root):
    """Extract synonym, comment, and basic properties."""
    obj.synonym = _find_property_text(root, "Synonym")
    obj.comment = _find_property_text(root, "Comment")

    props = ["CodeLength", "CodeType", "DescriptionLength", "Hierarchical",
             "HierarchyType", "LimitLevelCount", "Predefined"]
    for prop in props:
        val = _find_property_text(root, prop)
        if val:
            obj.properties[prop] = val


def _parse_catalog_attributes(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse catalog attributes (реквизиты) and extract type references."""
    attrs = _find_elements_by_local(root, "Attribute")
    for attr_elem in attrs:
        attr_name = _get_child_text(attr_elem, "Name")
        if not attr_name:
            continue

        type_refs = _extract_type_refs(attr_elem)
        attr = AttributeInfo(name=attr_name, types=type_refs)
        obj.attributes.append(attr)

        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute=attr_name,
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="attribute",
            )
            obj.references.append(ref)
            _add_reference_edge(graph, obj, tr, EdgeKind.CATALOG_TO_CATALOG, EdgeKind.CATALOG_TO_DOCUMENT)


def _parse_catalog_tabular_sections(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse tabular sections and their attributes."""
    ts_elements = _find_elements_by_local(root, "TabularSection")
    for ts_elem in ts_elements:
        ts_name = _get_child_text(ts_elem, "Name")
        if not ts_name:
            continue

        ts_info = TabularSectionInfo(name=ts_name)

        ts_attrs = _find_elements_by_local(ts_elem, "Attribute")
        for attr_elem in ts_attrs:
            attr_name = _get_child_text(attr_elem, "Name")
            if not attr_name:
                continue

            type_refs = _extract_type_refs(attr_elem)
            attr = AttributeInfo(
                name=attr_name,
                types=type_refs,
                tabular_section=ts_name,
            )
            ts_info.attributes.append(attr)

            for tr in type_refs:
                ref = ReferenceInfo(
                    source_attribute=attr_name,
                    target_type=tr.obj_type,
                    target_name=tr.name,
                    tabular_section=ts_name,
                    ref_kind="attribute",
                )
                obj.references.append(ref)
                _add_reference_edge(graph, obj, tr, EdgeKind.CATALOG_TO_CATALOG, EdgeKind.CATALOG_TO_DOCUMENT)

        obj.tabular_sections.append(ts_info)


def _parse_catalog_owners(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse catalog owners (Владельцы)."""
    owner_elements = _find_elements_by_local(root, "Owner")
    for oe in owner_elements:
        type_refs = _extract_type_refs_from_text(oe)
        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute="Owner",
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="owner",
            )
            obj.references.append(ref)

            source_key = get_full_object_key(obj.obj_type, obj.name)
            target_key = get_full_object_key(tr.obj_type, tr.name)
            graph.add_edge(Edge(
                source=source_key,
                target=target_key,
                kind=EdgeKind.OWNER,
                meta={"relation": "owner"},
            ))


def _parse_catalog_hierarchy(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse hierarchy settings."""
    hierarchical = _find_property_text(root, "Hierarchical")
    if hierarchical and hierarchical.lower() == "true":
        obj.properties["Hierarchical"] = "true"
        hierarchy_type = _find_property_text(root, "HierarchyType") or "HierarchyFoldersAndItems"
        obj.properties["HierarchyType"] = hierarchy_type

        source_key = get_full_object_key(obj.obj_type, obj.name)
        graph.add_edge(Edge(
            source=source_key,
            target=source_key,
            kind=EdgeKind.HIERARCHY,
            meta={"hierarchy_type": hierarchy_type},
        ))


def _parse_catalog_forms(obj: ObjectInfo, root):
    """Parse form references."""
    form_elements = _find_elements_by_local(root, "Form")
    for fe in form_elements:
        name = _get_child_text(fe, "Name") or (fe.text or "").strip()
        if name:
            obj.forms.append(name)


def _parse_catalog_commands(obj: ObjectInfo, root):
    """Parse command references."""
    cmd_elements = _find_elements_by_local(root, "Command")
    for ce in cmd_elements:
        name = _get_child_text(ce, "Name") or (ce.text or "").strip()
        if name:
            obj.commands.append(name)


def _parse_catalog_templates(obj: ObjectInfo, root):
    """Parse template references."""
    tpl_elements = _find_elements_by_local(root, "Template")
    for te in tpl_elements:
        name = _get_child_text(te, "Name") or (te.text or "").strip()
        if name:
            obj.templates.append(name)


def _add_reference_edge(graph: DependencyGraph, obj: ObjectInfo, tr: TypeRef,
                        same_kind: EdgeKind, doc_kind: EdgeKind):
    """Add an edge for a type reference from a catalog."""
    source_key = get_full_object_key(obj.obj_type, obj.name)
    target_key = get_full_object_key(tr.obj_type, tr.name)

    if tr.obj_type == "Catalog":
        kind = same_kind
    elif tr.obj_type == "Document":
        kind = doc_kind
    else:
        kind = same_kind

    graph.add_edge(Edge(source=source_key, target=target_key, kind=kind))


def _find_elements_by_local(root, local_name: str) -> list:
    """Find elements by local name (ignoring namespace)."""
    result = []
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            result.append(elem)
    return result


def _get_child_text(elem, child_local_name: str) -> str:
    """Get text of first child with given local name."""
    for child in elem:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == child_local_name:
            return (child.text or "").strip()
    return ""


def _find_property_text(root, prop_name: str) -> str:
    """Find property value by local tag name in Properties."""
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == prop_name:
            if elem.text:
                return elem.text.strip()
            for child in elem:
                child_tag = child.tag
                if "}" in child_tag:
                    child_tag = child_tag.split("}", 1)[1]
                if child_tag == "v" or child_tag == "Content":
                    return (child.text or "").strip()
    return ""


def _extract_type_refs(attr_elem) -> List[TypeRef]:
    """Extract TypeRef list from an attribute element's Type child."""
    type_elems = _find_elements_by_local(attr_elem, "Type")
    results = []
    for te in type_elems:
        refs = parse_types_from_element(te)
        results.extend(refs)
    if not results:
        refs = parse_types_from_element(attr_elem)
        results.extend(refs)
    return results


def _extract_type_refs_from_text(elem) -> List[TypeRef]:
    """Extract type refs from element text (e.g. owner list)."""
    from xml_helpers import parse_type_value
    text = (elem.text or "").strip()
    if text:
        ref = parse_type_value(text)
        if ref:
            return [ref]

    results = []
    for child in elem:
        refs = parse_types_from_element(child)
        results.extend(refs)
        child_text = (child.text or "").strip()
        if child_text:
            ref = parse_type_value(child_text)
            if ref:
                results.append(ref)
    return results
