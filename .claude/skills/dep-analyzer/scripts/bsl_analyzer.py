"""Static BSL analyzer for procedures, calls and metadata access."""

from __future__ import annotations

import os
import re
from typing import Dict, Iterable, List, Tuple

from models import BSLCall, BSLProcedure, BSLQueryRef, ObjectInfo


_PROC_RE = re.compile(
    r"^\s*(?:Процедура|Procedure|Функция|Function)\s+([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)\s*\((.*?)\)\s*(Экспорт|Export)?",
    flags=re.IGNORECASE,
)
_CALL_RE = re.compile(
    r"(?<![\w.])([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)\.([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)\s*\(",
    flags=re.IGNORECASE,
)

_META_PREFIX_MAP = {
    "Справочники": "Catalog",
    "Документы": "Document",
    "РегистрыСведений": "InformationRegister",
    "РегистрыНакопления": "AccumulationRegister",
    "РегистрыБухгалтерии": "AccountingRegister",
    "РегистрыРасчета": "CalculationRegister",
    "Перечисления": "Enum",
    "Catalogs": "Catalog",
    "Documents": "Document",
    "InformationRegisters": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "Enums": "Enum",
}
_META_ACCESS_RE = re.compile(
    r"(?<![\w.])("
    + "|".join(re.escape(prefix) for prefix in _META_PREFIX_MAP)
    + r")\.([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)",
    flags=re.IGNORECASE,
)

_QUERY_PREFIX_MAP = {
    "Справочник": "Catalog",
    "Документ": "Document",
    "РегистрСведений": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister",
    "РегистрРасчета": "CalculationRegister",
    "Перечисление": "Enum",
    "Catalog": "Catalog",
    "Document": "Document",
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
    "Enum": "Enum",
}
_QUERY_REF_RE = re.compile(
    r"(?<![\w.])("
    + "|".join(re.escape(prefix) for prefix in _QUERY_PREFIX_MAP)
    + r")\.([A-Za-zА-Яа-я_][A-Za-zА-Яа-я0-9_]*)",
    flags=re.IGNORECASE,
)

_CALL_SKIP_MODULES = {
    "ЭтотОбъект",
    "ThisObject",
    "Объект",
    "Object",
    "Результат",
    "Result",
    "Строка",
    "String",
    "Запрос",
    "Query",
}


def _safe_read_text(path: str) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1251"):
        try:
            with open(path, "r", encoding=encoding) as file_handle:
                return file_handle.read()
        except UnicodeDecodeError:
            continue
        except OSError:
            break
    return ""


def analyze_bsl_text(text: str, source_module: str, module_path: str) -> Tuple[List[BSLProcedure], List[BSLCall], List[BSLQueryRef]]:
    """Analyze BSL source text and return parsed entities."""
    procedures: List[BSLProcedure] = []
    calls: List[BSLCall] = []
    query_refs: List[BSLQueryRef] = []

    lines = text.splitlines()
    for idx, line in enumerate(lines, start=1):
        proc_match = _PROC_RE.search(line)
        if proc_match:
            keyword = line.strip().lower()
            is_function = keyword.startswith("функция") or keyword.startswith("function")
            procedures.append(
                BSLProcedure(
                    name=proc_match.group(1),
                    line_number=idx,
                    is_function=is_function,
                    is_export=bool(proc_match.group(3)),
                    module_path=module_path,
                )
            )

        for call_match in _CALL_RE.finditer(line):
            target_module = call_match.group(1)
            target_method = call_match.group(2)
            if target_module in _CALL_SKIP_MODULES:
                continue
            calls.append(
                BSLCall(
                    target_module=target_module,
                    target_method=target_method,
                    source_module=source_module,
                    source_line=idx,
                )
            )

        for meta_match in _META_ACCESS_RE.finditer(line):
            prefix = meta_match.group(1)
            obj_name = meta_match.group(2)
            obj_type = _META_PREFIX_MAP.get(prefix, "")
            if not obj_type:
                continue
            calls.append(
                BSLCall(
                    target_module=f"{obj_type}.{obj_name}",
                    target_method="",
                    source_module=source_module,
                    source_line=idx,
                )
            )

        for query_match in _QUERY_REF_RE.finditer(line):
            prefix = query_match.group(1)
            obj_name = query_match.group(2)
            obj_type = _QUERY_PREFIX_MAP.get(prefix, "Unknown")
            query_refs.append(
                BSLQueryRef(
                    obj_type=obj_type,
                    obj_name=obj_name,
                    source_module=source_module,
                    source_line=idx,
                )
            )

    return procedures, calls, query_refs


def analyze_bsl_module(module_file_path: str, source_module: str) -> Tuple[List[BSLProcedure], List[BSLCall], List[BSLQueryRef]]:
    text = _safe_read_text(module_file_path)
    if not text:
        return [], [], []
    return analyze_bsl_text(text, source_module=source_module, module_path=module_file_path)


def discover_object_bsl_files(obj_info: ObjectInfo) -> List[str]:
    """Discover .bsl files within object path."""
    base_path = obj_info.path
    if not base_path or not os.path.exists(base_path):
        return []
    result = []
    for root, _, files in os.walk(base_path):
        for filename in files:
            if filename.lower().endswith(".bsl"):
                result.append(os.path.join(root, filename))
    result.sort()
    return result


def analyze_objects_bsl(objects: Iterable[ObjectInfo]) -> None:
    """Populate BSL entities for each object in-place."""
    for obj_info in objects:
        source_key = f"{obj_info.obj_type}.{obj_info.name}"
        for module_path in discover_object_bsl_files(obj_info):
            procedures, calls, query_refs = analyze_bsl_module(module_path, source_module=source_key)
            obj_info.procedures.extend(procedures)
            obj_info.bsl_calls.extend(calls)
            obj_info.bsl_query_refs.extend(query_refs)


def analyze_objects_bsl_map(objects_by_key: Dict[str, ObjectInfo]) -> None:
    analyze_objects_bsl(objects_by_key.values())
