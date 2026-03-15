"""Static BSL analyzer: procedures, calls and metadata usage."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from models import BSLCall, BSLProcedure, BSLQueryRef


PROC_RE = re.compile(
    r"^\s*(?:Процедура|Procedure|Функция|Function)\s+([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)\s*\(",
    re.IGNORECASE,
)
IS_FUNCTION_RE = re.compile(r"^\s*(?:Функция|Function)\b", re.IGNORECASE)
IS_EXPORT_RE = re.compile(r"\b(?:Экспорт|Export)\b", re.IGNORECASE)
CALL_RE = re.compile(r"([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)\s*\(")

META_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\bСправочники\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Catalog"),
    (re.compile(r"\bДокументы\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Document"),
    (re.compile(r"\bРегистрыСведений\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "InformationRegister"),
    (re.compile(r"\bРегистрыНакопления\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "AccumulationRegister"),
    (re.compile(r"\bРегистрыБухгалтерии\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "AccountingRegister"),
    (re.compile(r"\bРегистрыРасчета\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "CalculationRegister"),
    (re.compile(r"\bПеречисления\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Enum"),
    (re.compile(r"\bCatalogs\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Catalog"),
    (re.compile(r"\bDocuments\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Document"),
    (re.compile(r"\bInformationRegisters\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "InformationRegister"),
    (re.compile(r"\bAccumulationRegisters\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "AccumulationRegister"),
]

QUERY_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\b(?:Справочник|Catalog)\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Catalog"),
    (re.compile(r"\b(?:Документ|Document)\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "Document"),
    (re.compile(r"\b(?:РегистрСведений|InformationRegister)\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "InformationRegister"),
    (re.compile(r"\b(?:РегистрНакопления|AccumulationRegister)\.([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)"), "AccumulationRegister"),
]


def _read_lines(path: Path) -> List[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return path.read_text(encoding="cp1251", errors="ignore").splitlines()
    except Exception:
        return []


def _iter_bsl_files(object_path: str) -> Iterable[Path]:
    root = Path(object_path)
    if not root.is_dir():
        return []
    return sorted(root.rglob("*.bsl"))


def analyze_bsl(graph) -> None:
    paths = [obj.path for obj in graph.objects.values() if obj.path]
    if paths:
        normalized = [str(Path(p).resolve()) for p in paths]
        config_root = Path(os.path.commonpath(normalized))
    else:
        config_root = Path(".")

    for key, obj in graph.objects.items():
        procedures: List[BSLProcedure] = []
        calls: List[BSLCall] = []
        query_refs: List[BSLQueryRef] = []
        seen_calls = set()
        seen_query_refs = set()

        for bsl_file in _iter_bsl_files(obj.path):
            lines = _read_lines(bsl_file)
            module_rel = str(bsl_file.resolve().relative_to(config_root.resolve()))

            for idx, line in enumerate(lines, start=1):
                proc_match = PROC_RE.search(line)
                if proc_match:
                    procedure_name = proc_match.group(1)
                    procedures.append(
                        BSLProcedure(
                            name=procedure_name,
                            line_number=idx,
                            is_function=bool(IS_FUNCTION_RE.search(line)),
                            is_export=bool(IS_EXPORT_RE.search(line)),
                            module_path=module_rel,
                        )
                    )

                for call_match in CALL_RE.finditer(line):
                    target_module, target_method = call_match.groups()
                    call_key = (target_module, target_method, module_rel, idx)
                    if call_key in seen_calls:
                        continue
                    seen_calls.add(call_key)
                    calls.append(
                        BSLCall(
                            target_module=target_module,
                            target_method=target_method,
                            source_module=key,
                            source_line=idx,
                        )
                    )

                for pattern, obj_type in META_PATTERNS:
                    for meta_match in pattern.finditer(line):
                        target_name = meta_match.group(1)
                        query_key = (obj_type, target_name, module_rel, idx, "meta")
                        if query_key in seen_query_refs:
                            continue
                        seen_query_refs.add(query_key)
                        query_refs.append(
                            BSLQueryRef(
                                obj_type=obj_type,
                                obj_name=target_name,
                                source_module=key,
                                source_line=idx,
                            )
                        )

                if '"' in line or "'" in line:
                    for pattern, obj_type in QUERY_PATTERNS:
                        for query_match in pattern.finditer(line):
                            target_name = query_match.group(1)
                            query_key = (obj_type, target_name, module_rel, idx, "query")
                            if query_key in seen_query_refs:
                                continue
                            seen_query_refs.add(query_key)
                            query_refs.append(
                                BSLQueryRef(
                                    obj_type=obj_type,
                                    obj_name=target_name,
                                    source_module=key,
                                    source_line=idx,
                                )
                            )

        obj.procedures = procedures
        obj.bsl_calls = calls
        obj.bsl_query_refs = query_refs

