"""Парсер прочих объектов метаданных: подписки, общие модули, перечисления, обработки,
отчёты, бизнес-процессы, задачи, планы обмена, константы."""

import os
from typing import List, Optional

from models import (
    ObjectInfo, DependencyGraph, AttributeInfo, TabularSectionInfo,
    ReferenceInfo, TypeRef, Edge, EdgeKind,
)
from xml_helpers import (
    parse_xml_file, parse_types_from_element, parse_type_value,
    get_full_object_key,
)
from scanner import get_object_xml_path


def parse_misc_objects(graph: DependencyGraph, config_path: str):
    """Parse all miscellaneous object types."""
    _parse_event_subscriptions(graph, config_path)
    _parse_common_modules(graph, config_path)
    _parse_enums(graph, config_path)
    _parse_data_processors(graph, config_path)
    _parse_reports(graph, config_path)
    _parse_business_processes(graph, config_path)
    _parse_tasks(graph, config_path)
    _parse_exchange_plans(graph, config_path)
    _parse_constants(graph, config_path)


def _parse_event_subscriptions(graph: DependencyGraph, config_path: str):
    """Parse EventSubscription objects."""
    subs = graph.get_objects_by_type("EventSubscription")
    for obj in subs:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.event = _find_property_text(root, "Event")
        obj.handler = _find_property_text(root, "Handler")

        source_elems = _find_elements_by_local(root, "Source")
        source_key = get_full_object_key(obj.obj_type, obj.name)

        for se in source_elems:
            for child in se:
                text = (child.text or "").strip()
                if text:
                    obj.source_types.append(text)
                    ref = parse_type_value(text)
                    if ref:
                        target_key = get_full_object_key(ref.obj_type, ref.name)
                        graph.add_edge(Edge(
                            source=source_key,
                            target=target_key,
                            kind=EdgeKind.SUBSCRIPTION_TO_OBJECT,
                            meta={"event": obj.event},
                        ))

            if not se.getchildren() if hasattr(se, 'getchildren') else len(se) == 0:
                text = (se.text or "").strip()
                if text:
                    obj.source_types.append(text)

        if obj.handler:
            parts = obj.handler.split(".")
            if len(parts) >= 2:
                module_name = parts[0]
                if graph.get_object("CommonModule", module_name):
                    target_key = get_full_object_key("CommonModule", module_name)
                    graph.add_edge(Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.SUBSCRIPTION_TO_MODULE,
                        meta={"handler": obj.handler},
                    ))


def _parse_common_modules(graph: DependencyGraph, config_path: str):
    """Parse CommonModule objects."""
    modules = graph.get_objects_by_type("CommonModule")
    for obj in modules:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        obj.is_global = _find_property_text(root, "Global").lower() == "true"
        obj.is_server = _find_property_text(root, "Server").lower() == "true"
        obj.is_client = (
            _find_property_text(root, "ClientManagedApplication").lower() == "true"
            or _find_property_text(root, "ClientOrdinaryApplication").lower() == "true"
        )
        obj.is_external = _find_property_text(root, "ExternalConnection").lower() == "true"

        props = ["Global", "Server", "ClientManagedApplication",
                 "ClientOrdinaryApplication", "ExternalConnection",
                 "ServerCall", "Privileged", "ReturnValuesReuse"]
        for prop in props:
            val = _find_property_text(root, prop)
            if val:
                obj.properties[prop] = val


def _parse_enums(graph: DependencyGraph, config_path: str):
    """Parse Enum objects."""
    enums = graph.get_objects_by_type("Enum")
    for obj in enums:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        values = _find_elements_by_local(root, "EnumValue")
        for ve in values:
            name = _get_child_text(ve, "Name")
            if name:
                obj.properties[f"Value.{name}"] = _get_child_text(ve, "Synonym") or name

        form_elements = _find_elements_by_local(root, "Form")
        for fe in form_elements:
            name = _get_child_text(fe, "Name") or (fe.text or "").strip()
            if name:
                obj.forms.append(name)


def _parse_data_processors(graph: DependencyGraph, config_path: str):
    """Parse DataProcessor objects."""
    processors = graph.get_objects_by_type("DataProcessor")
    for obj in processors:
        _parse_generic_object(obj, graph)


def _parse_reports(graph: DependencyGraph, config_path: str):
    """Parse Report objects."""
    reports = graph.get_objects_by_type("Report")
    for obj in reports:
        _parse_generic_object(obj, graph)


def _parse_business_processes(graph: DependencyGraph, config_path: str):
    """Parse BusinessProcess objects."""
    bps = graph.get_objects_by_type("BusinessProcess")
    for obj in bps:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        task_ref = _find_property_text(root, "Task")
        if task_ref:
            obj.properties["Task"] = task_ref

        _parse_generic_attributes(obj, root, graph)
        _parse_generic_tabular_sections(obj, root, graph)
        _parse_generic_forms(obj, root)


def _parse_tasks(graph: DependencyGraph, config_path: str):
    """Parse Task objects."""
    tasks = graph.get_objects_by_type("Task")
    for obj in tasks:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        bp_ref = _find_property_text(root, "BusinessProcess")
        if bp_ref:
            obj.properties["BusinessProcess"] = bp_ref

        _parse_generic_attributes(obj, root, graph)
        _parse_generic_forms(obj, root)


def _parse_exchange_plans(graph: DependencyGraph, config_path: str):
    """Parse ExchangePlan objects."""
    plans = graph.get_objects_by_type("ExchangePlan")
    for obj in plans:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        content_elements = _find_elements_by_local(root, "Content")
        for ce in content_elements:
            for child in ce:
                text = (child.text or "").strip()
                if text:
                    obj.properties[f"Content.{text}"] = "true"

        _parse_generic_attributes(obj, root, graph)
        _parse_generic_tabular_sections(obj, root, graph)
        _parse_generic_forms(obj, root)


def _parse_constants(graph: DependencyGraph, config_path: str):
    """Parse Constant objects."""
    constants = graph.get_objects_by_type("Constant")
    for obj in constants:
        xml_path = get_object_xml_path(obj)
        if not xml_path:
            continue

        root = parse_xml_file(xml_path)
        if root is None:
            continue

        obj.synonym = _find_property_text(root, "Synonym")
        obj.comment = _find_property_text(root, "Comment")

        type_refs = _extract_type_refs(root)
        for tr in type_refs:
            ref = ReferenceInfo(
                source_attribute="Value",
                target_type=tr.obj_type,
                target_name=tr.name,
                ref_kind="attribute",
            )
            obj.references.append(ref)


def _parse_generic_object(obj: ObjectInfo, graph: DependencyGraph):
    """Parse generic object with attributes, tabular sections, and forms."""
    xml_path = get_object_xml_path(obj)
    if not xml_path:
        return

    root = parse_xml_file(xml_path)
    if root is None:
        return

    obj.synonym = _find_property_text(root, "Synonym")
    obj.comment = _find_property_text(root, "Comment")

    _parse_generic_attributes(obj, root, graph)
    _parse_generic_tabular_sections(obj, root, graph)
    _parse_generic_forms(obj, root)
    _parse_generic_commands(obj, root)
    _parse_generic_templates(obj, root)


def _parse_generic_attributes(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse attributes for any object type."""
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


def _parse_generic_tabular_sections(obj: ObjectInfo, root, graph: DependencyGraph):
    """Parse tabular sections for any object type."""
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

        obj.tabular_sections.append(ts_info)


def _parse_generic_forms(obj: ObjectInfo, root):
    form_elements = _find_elements_by_local(root, "Form")
    for fe in form_elements:
        name = _get_child_text(fe, "Name") or (fe.text or "").strip()
        if name:
            obj.forms.append(name)


def _parse_generic_commands(obj: ObjectInfo, root):
    cmd_elements = _find_elements_by_local(root, "Command")
    for ce in cmd_elements:
        name = _get_child_text(ce, "Name") or (ce.text or "").strip()
        if name:
            obj.commands.append(name)


def _parse_generic_templates(obj: ObjectInfo, root):
    tpl_elements = _find_elements_by_local(root, "Template")
    for te in tpl_elements:
        name = _get_child_text(te, "Name") or (te.text or "").strip()
        if name:
            obj.templates.append(name)


def _find_elements_by_local(root, local_name: str) -> list:
    result = []
    for elem in root.iter():
        tag = elem.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == local_name:
            result.append(elem)
    return result


def _get_child_text(elem, child_local_name: str) -> str:
    for child in elem:
        tag = child.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag == child_local_name:
            return (child.text or "").strip()
    return ""


def _find_property_text(root, prop_name: str) -> str:
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
                if child_tag in ("v", "Content"):
                    return (child.text or "").strip()
    return ""


def _extract_type_refs(attr_elem) -> list:
    type_elems = _find_elements_by_local(attr_elem, "Type")
    results = []
    for te in type_elems:
        refs = parse_types_from_element(te)
        results.extend(refs)
    if not results:
        refs = parse_types_from_element(attr_elem)
        results.extend(refs)
    return results
