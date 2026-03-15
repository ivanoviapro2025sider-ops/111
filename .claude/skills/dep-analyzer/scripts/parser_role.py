"""Role and rights parser, including RLS extraction."""

from __future__ import annotations

import os
import re
from collections import defaultdict
from typing import Dict, Iterable, List

from models import ObjectInfo, ObjectRights, RLSTemplate, RightInfo, RoleInfo
from scanner import get_xml_text, load_object_xml, parse_boolean, resolve_object_xml_path
from xml_helpers import parse_xml_file


OBJECT_PATTERN = re.compile(
    r"(Catalog|Document|InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister|Enum|ChartOfCharacteristicTypes|ChartOfAccounts|ChartOfCalculationTypes|BusinessProcess|Task|ExchangePlan|Report|DataProcessor|CommonModule|EventSubscription|Role|Constant|DocumentJournal|ScheduledJob|DefinedType|HTTPService|WebService)\.([A-Za-zА-Яа-я0-9_\.]+)"
)
RIGHT_PATTERN = re.compile(
    r"\b(Read|Insert|Update|Delete|View|Execute|InteractiveDelete|Posting|Administration|Use|Edit|InputByString|Open|Set)\b",
    re.IGNORECASE,
)


def _local_name(tag: str) -> str:
    if "}" in tag:
        tag = tag.split("}", 1)[1]
    if ":" in tag:
        tag = tag.split(":", 1)[1]
    return tag


def _iter_role_related_files(obj_info: ObjectInfo) -> Iterable[str]:
    seen = set()
    xml_path = resolve_object_xml_path(obj_info)
    if xml_path:
        seen.add(xml_path)
        yield xml_path

    base_paths = {obj_info.path, os.path.dirname(xml_path)}
    for base_path in base_paths:
        if not base_path or not os.path.isdir(base_path):
            continue
        for current_root, _, files in os.walk(base_path):
            for file_name in files:
                if not file_name.lower().endswith(".xml"):
                    continue
                if "right" not in file_name.lower() and file_name != os.path.basename(xml_path):
                    continue
                full_path = os.path.join(current_root, file_name)
                if full_path not in seen:
                    seen.add(full_path)
                    yield full_path


def _string_values(element) -> List[str]:
    values = []
    if element.text and element.text.strip():
        values.append(element.text.strip())
    values.extend(str(value).strip() for value in element.attrib.values() if str(value).strip())
    for child in element:
        if child.text and child.text.strip():
            values.append(child.text.strip())
        values.extend(str(value).strip() for value in child.attrib.values() if str(value).strip())
    return values


def _extract_templates(root) -> List[RLSTemplate]:
    templates: List[RLSTemplate] = []
    for node in root.xpath(".//*[contains(local-name(), 'Template')]"):
        name = (
            node.get("name")
            or node.get("Name")
            or get_xml_text(node, "./*[local-name()='Name']/text()", "")
            or get_xml_text(node, "./*[local-name()='Presentation']/text()", "")
        )
        condition = (
            get_xml_text(node, ".//*[local-name()='Condition']/text()", "")
            or get_xml_text(node, ".//*[local-name()='Where']/text()", "")
            or get_xml_text(node, ".//*[local-name()='Filter']/text()", "")
        )
        if name or condition:
            templates.append(RLSTemplate(name=name or "UnnamedTemplate", condition=condition))
    return templates


def _extract_rights_from_root(root) -> List[ObjectRights]:
    grouped: Dict[str, List[RightInfo]] = defaultdict(list)

    for element in root.iter():
        local = _local_name(str(element.tag))
        if local.lower() not in {"entry", "right", "objectright", "permission", "rightvalue"} and not any(
            key in element.attrib for key in ("right", "Right", "object", "Object", "value", "Value")
        ):
            continue
        values = _string_values(element)
        blob = " ".join(values)
        objects = [f"{match.group(1)}.{match.group(2)}" for match in OBJECT_PATTERN.finditer(blob)]
        if not objects:
            continue

        right_name = (
            element.get("right")
            or element.get("Right")
            or element.get("name")
            or element.get("Name")
            or get_xml_text(element, "./*[local-name()='RightName']/text()", "")
        )
        if not right_name:
            match = RIGHT_PATTERN.search(blob)
            right_name = match.group(1) if match else ""
        if not right_name:
            continue

        value_raw = (
            element.get("value")
            or element.get("Value")
            or element.get("allowed")
            or element.get("Allowed")
            or get_xml_text(element, "./*[local-name()='Value']/text()", "")
            or get_xml_text(element, "./*[local-name()='Allowed']/text()", "")
        )
        value = parse_boolean(value_raw, default=True) if value_raw != "" else True

        rls_condition = (
            get_xml_text(element, ".//*[local-name()='Condition']/text()", "")
            or get_xml_text(element, ".//*[local-name()='Where']/text()", "")
            or get_xml_text(element, ".//*[local-name()='Filter']/text()", "")
            or get_xml_text(element, ".//*[contains(local-name(), 'Restriction')]/text()", "")
        )
        has_rls = bool(rls_condition) or "rls" in local.lower() or "restriction" in local.lower()

        for object_name in objects:
            grouped[object_name].append(
                RightInfo(
                    right_name=right_name,
                    value=value,
                    has_rls=has_rls,
                    rls_condition=rls_condition,
                )
            )

    return [ObjectRights(object_name=name, rights=rights) for name, rights in sorted(grouped.items())]


def parse_role(obj_info: ObjectInfo) -> ObjectInfo:
    """Parse a role object, including rights and RLS templates."""

    main_root = load_object_xml(obj_info)
    role_info = RoleInfo(name=obj_info.name)

    if main_root is not None:
        role_info.synonym = get_xml_text(main_root, ".//*[local-name()='Synonym']/text()", "")
        role_info.set_for_new_objects = parse_boolean(
            get_xml_text(main_root, ".//*[local-name()='SetForNewObjects']/text()", "false")
        )
        role_info.set_for_attributes_by_default = parse_boolean(
            get_xml_text(main_root, ".//*[local-name()='SetForAttributesByDefault']/text()", "true"),
            default=True,
        )
        role_info.independent_rights = parse_boolean(
            get_xml_text(main_root, ".//*[local-name()='IndependentRightsOfChildObjects']/text()", "false")
        )

    object_rights: List[ObjectRights] = []
    templates: List[RLSTemplate] = []
    for file_path in _iter_role_related_files(obj_info):
        root = parse_xml_file(file_path)
        if root is None:
            continue
        object_rights.extend(_extract_rights_from_root(root))
        templates.extend(_extract_templates(root))

    deduped_rights: Dict[str, List[RightInfo]] = defaultdict(list)
    seen_rights = set()
    for object_right in object_rights:
        for right in object_right.rights:
            key = (
                object_right.object_name,
                right.right_name,
                right.value,
                right.has_rls,
                right.rls_condition,
            )
            if key in seen_rights:
                continue
            seen_rights.add(key)
            deduped_rights[object_right.object_name].append(right)

    role_info.object_rights = [
        ObjectRights(object_name=object_name, rights=rights)
        for object_name, rights in sorted(deduped_rights.items())
    ]

    seen_templates = set()
    role_info.rls_templates = []
    for template in templates:
        key = (template.name, template.condition)
        if key in seen_templates:
            continue
        seen_templates.add(key)
        role_info.rls_templates.append(template)

    obj_info.role_info = role_info
    return obj_info


def parse_roles(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        if obj_info.obj_type == "Role":
            objects[key] = parse_role(obj_info)
    return objects
