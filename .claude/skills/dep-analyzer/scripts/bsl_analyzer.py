"""Static BSL analyzer: procedures, calls, metadata refs and debug points."""

from __future__ import annotations

import os
import re
from typing import Dict, Iterable, List, Optional, Tuple

from models import BSLCall, BSLProcedure, BSLQueryRef, DebugPoint, ObjectInfo

PROC_RE = re.compile(
    r"^\s*(Procedure|Function|Процедура|Функция)\s+([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\((.*?)\)\s*(Export|Экспорт)?",
    re.IGNORECASE,
)
CALL_RE = re.compile(r"([A-Za-zА-Яа-я_][\wА-Яа-я]*)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\(")

META_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"(Catalogs|Справочники)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "Catalog"),
    (re.compile(r"(Documents|Документы)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "Document"),
    (re.compile(r"(InformationRegisters|РегистрыСведений)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "InformationRegister"),
    (re.compile(r"(AccumulationRegisters|РегистрыНакопления)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "AccumulationRegister"),
    (re.compile(r"(AccountingRegisters|РегистрыБухгалтерии)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "AccountingRegister"),
    (re.compile(r"(CalculationRegisters|РегистрыРасчета)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "CalculationRegister"),
    (re.compile(r"(Enums|Перечисления)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "Enum"),
    (re.compile(r"(Constants|Константы)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"), "Constant"),
]

DEBUG_PROCEDURE_CANDIDATES = {
    "posting",
    "обработкапроведения",
    "beforewrite",
    "передзаписью",
    "onwrite",
    "призаписи",
    "onpost",
    "обработкапроведения",
}


def _iter_bsl_files(object_path: str) -> Iterable[str]:
    if not object_path:
        return
    if os.path.isfile(object_path) and object_path.lower().endswith(".bsl"):
        yield object_path
        return

    if os.path.isfile(object_path):
        return

    for root, _, files in os.walk(object_path):
        for file_name in files:
            if file_name.lower().endswith(".bsl"):
                yield os.path.join(root, file_name)


def _relative_module_path(base: str, file_path: str) -> str:
    try:
        return os.path.relpath(file_path, base)
    except ValueError:
        return file_path


def _parse_metadata_refs(line: str, module_path: str, line_number: int) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    for pattern, obj_type in META_PATTERNS:
        for match in pattern.finditer(line):
            refs.append(
                BSLQueryRef(
                    obj_type=obj_type,
                    obj_name=match.group(2),
                    source_module=module_path,
                    source_line=line_number,
                )
            )
    return refs


def _analyze_file(base_path: str, file_path: str) -> Tuple[List[BSLProcedure], List[BSLCall], List[BSLQueryRef]]:
    procedures: List[BSLProcedure] = []
    calls: List[BSLCall] = []
    refs: List[BSLQueryRef] = []

    module_path = _relative_module_path(base_path, file_path)
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
            lines = file.readlines()
    except OSError:
        return procedures, calls, refs

    for line_number, line in enumerate(lines, start=1):
        proc_match = PROC_RE.search(line)
        if proc_match:
            keyword, proc_name, _, export_token = proc_match.groups()
            procedures.append(
                BSLProcedure(
                    name=proc_name,
                    line_number=line_number,
                    is_function=keyword.lower() in {"function", "функция"},
                    is_export=bool(export_token),
                    module_path=module_path,
                )
            )

        for call_match in CALL_RE.finditer(line):
            module_name, method_name = call_match.groups()
            calls.append(
                BSLCall(
                    target_module=module_name,
                    target_method=method_name,
                    source_module=module_path,
                    source_line=line_number,
                )
            )

        refs.extend(_parse_metadata_refs(line, module_path, line_number))

    return procedures, calls, refs


def analyze_bsl(objects: Dict[str, ObjectInfo], config_root: Optional[str] = None) -> None:
    """Analyze BSL modules for all scanned objects."""
    if config_root is None:
        config_root = os.getcwd()

    for obj in objects.values():
        obj.procedures = []
        obj.bsl_calls = []
        obj.bsl_query_refs = []
        for bsl_file in _iter_bsl_files(obj.path):
            procedures, calls, refs = _analyze_file(config_root, bsl_file)
            obj.procedures.extend(procedures)
            obj.bsl_calls.extend(calls)
            obj.bsl_query_refs.extend(refs)


def _find_procedure_line(objects: Dict[str, ObjectInfo], module_name: str, method_name: str) -> Tuple[bool, str, int]:
    method_lc = method_name.lower()
    for obj in objects.values():
        if obj.obj_type != "CommonModule":
            continue
        if obj.name.lower() != module_name.lower():
            continue
        for proc in obj.procedures:
            if proc.name.lower() == method_lc:
                return True, proc.module_path, proc.line_number
        # Module found but method absent.
        return False, (obj.procedures[0].module_path if obj.procedures else ""), 0
    return False, "", 0


def collect_debug_points(objects: Dict[str, ObjectInfo]) -> List[DebugPoint]:
    """Build probable breakpoints for document posting and subscriptions."""
    debug_points: List[DebugPoint] = []

    for obj in objects.values():
        if obj.obj_type == "Document":
            for proc in obj.procedures:
                if proc.name.lower() in DEBUG_PROCEDURE_CANDIDATES:
                    debug_points.append(
                        DebugPoint(
                            procedure_name=proc.name,
                            module_path=proc.module_path,
                            line_number=proc.line_number,
                            context="Проведение документа",
                            exists=True,
                            source_object=obj.name,
                            source_type=obj.obj_type,
                        )
                    )

        if obj.obj_type == "EventSubscription":
            handler = obj.handler or ""
            if "." in handler:
                module_name, method_name = handler.split(".", 1)
                exists, module_path, line_number = _find_procedure_line(objects, module_name, method_name)
            else:
                module_name, method_name = handler, ""
                exists, module_path, line_number = False, "", 0
            debug_points.append(
                DebugPoint(
                    procedure_name=method_name or handler or "UnknownHandler",
                    module_path=module_path,
                    line_number=line_number,
                    context=f"Подписка на событие: {obj.event or 'unknown'}",
                    exists=exists,
                    source_object=obj.name,
                    source_type=obj.obj_type,
                )
            )

    return debug_points
