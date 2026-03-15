"""Static BSL analysis for procedures, calls, metadata access and queries."""

from __future__ import annotations

import os
import re
from typing import Dict, Iterable, List, Optional

from models import BSLCall, BSLProcedure, BSLQueryRef, DebugPoint, ObjectInfo
from scanner import find_module_files


PROCEDURE_RE = re.compile(
    r"^\s*(Procedure|Function|Процедура|Функция)\s+([A-Za-zА-Яа-я0-9_]+)\s*(?:\([^)]*\))?\s*(Export|Экспорт)?",
    re.IGNORECASE,
)
CALL_RE = re.compile(r"\b([A-Za-zА-Яа-я0-9_]+(?:\.[A-Za-zА-Яа-я0-9_]+)+)\s*\(")
STRING_RE = re.compile(r'"((?:[^"]|"")*)"')

META_ACCESS_PATTERNS = {
    "Catalog": [
        re.compile(r"\b(?:Metadata\.)?Catalogs\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.Справочники\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bСправочники\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "Document": [
        re.compile(r"\b(?:Metadata\.)?Documents\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.Документы\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bДокументы\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "InformationRegister": [
        re.compile(r"\b(?:Metadata\.)?InformationRegisters\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.РегистрыСведений\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрыСведений\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрСведений\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "AccumulationRegister": [
        re.compile(r"\b(?:Metadata\.)?AccumulationRegisters\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.РегистрыНакопления\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрыНакопления\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрНакопления\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "AccountingRegister": [
        re.compile(r"\b(?:Metadata\.)?AccountingRegisters\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.РегистрыБухгалтерии\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрыБухгалтерии\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрБухгалтерии\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "CalculationRegister": [
        re.compile(r"\b(?:Metadata\.)?CalculationRegisters\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.РегистрыРасчета\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрыРасчета\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bРегистрРасчета\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "Enum": [
        re.compile(r"\b(?:Metadata\.)?Enums\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.Перечисления\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bПеречисления\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "CommonModule": [
        re.compile(r"\b(?:Metadata\.)?CommonModules\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.ОбщиеМодули\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bОбщиеМодули\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
    "Constant": [
        re.compile(r"\b(?:Metadata\.)?Constants\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bМетаданные\.Константы\.([A-Za-zА-Яа-я0-9_]+)\b"),
        re.compile(r"\bКонстанты\.([A-Za-zА-Яа-я0-9_]+)\b"),
    ],
}

QUERY_PATTERNS = {
    "Catalog": [re.compile(r"\b(?:Catalog|Справочник)\.([A-Za-zА-Яа-я0-9_]+)\b")],
    "Document": [re.compile(r"\b(?:Document|Документ)\.([A-Za-zА-Яа-я0-9_]+)\b")],
    "InformationRegister": [
        re.compile(r"\b(?:InformationRegister|РегистрСведений)\.([A-Za-zА-Яа-я0-9_]+)\b")
    ],
    "AccumulationRegister": [
        re.compile(r"\b(?:AccumulationRegister|РегистрНакопления)\.([A-Za-zА-Яа-я0-9_]+)\b")
    ],
    "AccountingRegister": [
        re.compile(r"\b(?:AccountingRegister|РегистрБухгалтерии)\.([A-Za-zА-Яа-я0-9_]+)\b")
    ],
    "CalculationRegister": [
        re.compile(r"\b(?:CalculationRegister|РегистрРасчета)\.([A-Za-zА-Яа-я0-9_]+)\b")
    ],
}

DEBUG_NAME_HINTS = {
    "Document": {
        "ОбработкаПроведения": "Проведение документа",
        "Posting": "Проведение документа",
        "ПриЗаписи": "Запись документа",
        "BeforeWrite": "Перед записью документа",
        "ПередЗаписью": "Перед записью документа",
        "OnWrite": "Запись документа",
        "ПослеЗаписи": "После записи документа",
    },
    "Catalog": {
        "ПриЗаписи": "Запись элемента справочника",
        "ПередЗаписью": "Перед записью элемента справочника",
        "OnWrite": "Запись элемента справочника",
        "BeforeWrite": "Перед записью элемента справочника",
    },
}


def _read_lines(file_path: str) -> List[str]:
    with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as stream:
        return stream.readlines()


def _module_key_from_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    parts = normalized.split("/")
    if len(parts) >= 2:
        folder = parts[0]
        object_name = parts[1]
        if folder == "CommonModules":
            return f"CommonModule.{object_name}"
        if folder == "Catalogs":
            return f"Catalog.{object_name}"
        if folder == "Documents":
            return f"Document.{object_name}"
        if folder == "InformationRegisters":
            return f"InformationRegister.{object_name}"
        if folder == "AccumulationRegisters":
            return f"AccumulationRegister.{object_name}"
        if folder == "AccountingRegisters":
            return f"AccountingRegister.{object_name}"
        if folder == "CalculationRegisters":
            return f"CalculationRegister.{object_name}"
    return normalized


def _parse_procedures(lines: Iterable[str], module_path: str) -> List[BSLProcedure]:
    procedures: List[BSLProcedure] = []
    for line_number, line in enumerate(lines, start=1):
        match = PROCEDURE_RE.search(line)
        if not match:
            continue
        kind, name, export_marker = match.groups()
        procedures.append(
            BSLProcedure(
                name=name,
                line_number=line_number,
                is_function=kind.lower() in {"function", "функция"},
                is_export=bool(export_marker),
                module_path=module_path,
            )
        )
    return procedures


def _parse_calls(lines: Iterable[str], module_path: str) -> List[BSLCall]:
    calls: List[BSLCall] = []
    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("|"):
            continue
        for match in CALL_RE.finditer(line):
            full_name = match.group(1)
            parts = full_name.split(".")
            if len(parts) < 2:
                continue
            calls.append(
                BSLCall(
                    target_module=".".join(parts[:-1]),
                    target_method=parts[-1],
                    source_module=module_path,
                    source_line=line_number,
                )
            )
    return calls


def _parse_metadata_refs(lines: Iterable[str], module_path: str) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    seen = set()

    for line_number, line in enumerate(lines, start=1):
        for obj_type, patterns in META_ACCESS_PATTERNS.items():
            for pattern in patterns:
                for match in pattern.finditer(line):
                    key = (obj_type, match.group(1), line_number)
                    if key in seen:
                        continue
                    seen.add(key)
                    refs.append(
                        BSLQueryRef(
                            obj_type=obj_type,
                            obj_name=match.group(1),
                            source_module=module_path,
                            source_line=line_number,
                        )
                    )
    return refs


def _parse_query_refs(lines: Iterable[str], module_path: str) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    seen = set()

    for line_number, line in enumerate(lines, start=1):
        for string_match in STRING_RE.finditer(line):
            string_value = string_match.group(1).replace('""', '"')
            for obj_type, patterns in QUERY_PATTERNS.items():
                for pattern in patterns:
                    for match in pattern.finditer(string_value):
                        key = (obj_type, match.group(1), line_number)
                        if key in seen:
                            continue
                        seen.add(key)
                        refs.append(
                            BSLQueryRef(
                                obj_type=obj_type,
                                obj_name=match.group(1),
                                source_module=module_path,
                                source_line=line_number,
                            )
                        )
    return refs


def analyze_object_bsl(obj_info: ObjectInfo, root_path: str) -> ObjectInfo:
    """Analyze all BSL modules attached to an object."""

    procedures: List[BSLProcedure] = []
    calls: List[BSLCall] = []
    meta_refs: List[BSLQueryRef] = []
    query_refs: List[BSLQueryRef] = []

    for module_path in find_module_files(obj_info):
        full_path = module_path
        if not os.path.isabs(full_path):
            full_path = os.path.join(root_path, module_path)
        if not os.path.exists(full_path):
            continue
        lines = _read_lines(full_path)
        procedures.extend(_parse_procedures(lines, module_path))
        calls.extend(_parse_calls(lines, module_path))
        meta_refs.extend(_parse_metadata_refs(lines, module_path))
        query_refs.extend(_parse_query_refs(lines, module_path))

    obj_info.procedures = _dedupe_procedures(procedures)
    obj_info.bsl_calls = _dedupe_calls(calls)
    obj_info.bsl_meta_refs = _dedupe_query_refs(meta_refs)
    obj_info.bsl_query_refs = _dedupe_query_refs(query_refs)
    return obj_info


def analyze_bsl(objects: Dict[str, ObjectInfo], root_path: str) -> Dict[str, ObjectInfo]:
    for key, obj_info in objects.items():
        objects[key] = analyze_object_bsl(obj_info, root_path)
    return objects


def _dedupe_procedures(items: Iterable[BSLProcedure]) -> List[BSLProcedure]:
    seen = set()
    result = []
    for item in items:
        key = (item.name, item.line_number, item.module_path)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _dedupe_calls(items: Iterable[BSLCall]) -> List[BSLCall]:
    seen = set()
    result = []
    for item in items:
        key = (item.target_module, item.target_method, item.source_module, item.source_line)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _dedupe_query_refs(items: Iterable[BSLQueryRef]) -> List[BSLQueryRef]:
    seen = set()
    result = []
    for item in items:
        key = (item.obj_type, item.obj_name, item.source_module, item.source_line)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def find_procedure(obj_info: ObjectInfo, procedure_name: str) -> Optional[BSLProcedure]:
    procedure_name = procedure_name.strip()
    for procedure in obj_info.procedures:
        if procedure.name.lower() == procedure_name.lower():
            return procedure
    return None


def resolve_handler_debug_point(
    handler: str,
    objects: Dict[str, ObjectInfo],
    *,
    context: str,
    source_object: str,
    source_type: str,
) -> DebugPoint:
    """Resolve a subscription handler into a concrete procedure location."""

    module_name = handler
    procedure_name = ""
    if "." in handler:
        module_name, procedure_name = handler.rsplit(".", 1)

    candidates = [
        f"CommonModule.{module_name}",
        module_name if "." in module_name else "",
    ]

    for candidate in candidates:
        if not candidate:
            continue
        obj_info = objects.get(candidate)
        if obj_info is None:
            continue
        procedure = find_procedure(obj_info, procedure_name) if procedure_name else None
        module_path = procedure.module_path if procedure else (obj_info.procedures[0].module_path if obj_info.procedures else "")
        line_number = procedure.line_number if procedure else 0
        return DebugPoint(
            procedure_name=procedure_name or handler,
            module_path=module_path,
            line_number=line_number,
            context=context,
            exists=procedure is not None if procedure_name else bool(module_path),
            source_object=source_object,
            source_type=source_type,
        )

    return DebugPoint(
        procedure_name=procedure_name or handler,
        module_path="",
        line_number=0,
        context=context,
        exists=False,
        source_object=source_object,
        source_type=source_type,
    )


def collect_intrinsic_debug_points(obj_info: ObjectInfo) -> List[DebugPoint]:
    """Collect object-local debug points based on known lifecycle procedures."""

    result: List[DebugPoint] = []
    hints = DEBUG_NAME_HINTS.get(obj_info.obj_type, {})

    for procedure in obj_info.procedures:
        if procedure.name not in hints:
            continue
        result.append(
            DebugPoint(
                procedure_name=procedure.name,
                module_path=procedure.module_path,
                line_number=procedure.line_number,
                context=hints[procedure.name],
                exists=True,
                source_object=obj_info.name,
                source_type=obj_info.obj_type,
            )
        )

    return result
