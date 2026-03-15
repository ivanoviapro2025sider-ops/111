"""Static BSL analyzer: procedures, calls, metadata access, query refs."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from models import BSLCall, BSLProcedure, BSLQueryRef, ObjectInfo

_PROC_RE = re.compile(
    r"^\s*(?:Процедура|Procedure|Функция|Function)\s+([A-Za-zА-Яа-я0-9_]+)\s*\((.*?)\)\s*(?:Экспорт|Export)?",
    re.IGNORECASE,
)
_PROC_KIND_RE = re.compile(r"^\s*(Процедура|Procedure|Функция|Function)\b", re.IGNORECASE)
_EXPORT_RE = re.compile(r"\b(?:Экспорт|Export)\b", re.IGNORECASE)

_CALL_RE = re.compile(r"\b([A-Za-zА-Яа-я0-9_]+)\.([A-Za-zА-Яа-я0-9_]+)\s*\(")

_META_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\b(?:Справочники|Catalogs)\.([A-Za-zА-Яа-я0-9_]+)\b", re.IGNORECASE), "Catalog"),
    (re.compile(r"\b(?:Документы|Documents)\.([A-Za-zА-Яа-я0-9_]+)\b", re.IGNORECASE), "Document"),
    (
        re.compile(
            r"\b(?:РегистрыСведений|InformationRegisters)\.([A-Za-zА-Яа-я0-9_]+)\b",
            re.IGNORECASE,
        ),
        "InformationRegister",
    ),
    (
        re.compile(
            r"\b(?:РегистрыНакопления|AccumulationRegisters)\.([A-Za-zА-Яа-я0-9_]+)\b",
            re.IGNORECASE,
        ),
        "AccumulationRegister",
    ),
    (
        re.compile(
            r"\b(?:РегистрыБухгалтерии|AccountingRegisters)\.([A-Za-zА-Яа-я0-9_]+)\b",
            re.IGNORECASE,
        ),
        "AccountingRegister",
    ),
    (
        re.compile(
            r"\b(?:РегистрыРасчета|CalculationRegisters)\.([A-Za-zА-Яа-я0-9_]+)\b",
            re.IGNORECASE,
        ),
        "CalculationRegister",
    ),
    (re.compile(r"\b(?:Перечисления|Enums)\.([A-Za-zА-Яа-я0-9_]+)\b", re.IGNORECASE), "Enum"),
]

_QUERY_MARKERS = ("ВЫБРАТЬ", "SELECT", "ИЗ", "FROM")


def _iter_bsl_files(obj: ObjectInfo) -> Iterable[Path]:
    path = Path(obj.path)
    if not path.exists():
        return []
    if path.is_file() and path.suffix.lower() == ".bsl":
        return [path]
    if path.is_file():
        return []
    return sorted(p for p in path.rglob("*.bsl") if p.is_file())


def _relative_module_path(path: Path, config_root: Path | None) -> str:
    if config_root:
        try:
            return str(path.relative_to(config_root))
        except ValueError:
            return str(path)
    return str(path)


def _extract_query_refs(line: str, source_module: str, source_line: int) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    if not any(marker in line.upper() for marker in _QUERY_MARKERS):
        return refs
    for pattern, obj_type in _META_PATTERNS:
        for match in pattern.finditer(line):
            refs.append(
                BSLQueryRef(
                    obj_type=obj_type,
                    obj_name=match.group(1),
                    source_module=source_module,
                    source_line=source_line,
                )
            )
    return refs


def analyze_bsl_for_object(obj: ObjectInfo, config_root: str = "") -> None:
    """Analyze all BSL modules for one metadata object."""
    root_path = Path(config_root) if config_root else None
    procedures: List[BSLProcedure] = []
    calls: List[BSLCall] = []
    query_refs: List[BSLQueryRef] = []

    for bsl_file in _iter_bsl_files(obj):
        try:
            text = bsl_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = bsl_file.read_text(encoding="cp1251", errors="ignore")

        module_path = _relative_module_path(bsl_file, root_path)
        lines = text.splitlines()
        for idx, line in enumerate(lines, start=1):
            proc_match = _PROC_RE.search(line)
            if proc_match:
                proc_name = proc_match.group(1)
                kind_match = _PROC_KIND_RE.search(line)
                kind = kind_match.group(1).lower() if kind_match else ""
                procedures.append(
                    BSLProcedure(
                        name=proc_name,
                        line_number=idx,
                        is_function=kind in {"функция", "function"},
                        is_export=bool(_EXPORT_RE.search(line)),
                        module_path=module_path,
                    )
                )

            for call_match in _CALL_RE.finditer(line):
                module_name, method_name = call_match.groups()
                calls.append(
                    BSLCall(
                        target_module=module_name,
                        target_method=method_name,
                        source_module=module_path,
                        source_line=idx,
                    )
                )

            for pattern, obj_type in _META_PATTERNS:
                for meta_match in pattern.finditer(line):
                    query_refs.append(
                        BSLQueryRef(
                            obj_type=obj_type,
                            obj_name=meta_match.group(1),
                            source_module=module_path,
                            source_line=idx,
                        )
                    )

            query_refs.extend(_extract_query_refs(line, module_path, idx))

    # de-dup
    proc_seen = set()
    for proc in procedures:
        sig = (proc.name, proc.module_path, proc.line_number)
        if sig in proc_seen:
            continue
        proc_seen.add(sig)
        obj.procedures.append(proc)

    call_seen = set()
    for call in calls:
        sig = (call.target_module, call.target_method, call.source_module, call.source_line)
        if sig in call_seen:
            continue
        call_seen.add(sig)
        obj.bsl_calls.append(call)

    ref_seen = set()
    for ref in query_refs:
        sig = (ref.obj_type, ref.obj_name, ref.source_module, ref.source_line)
        if sig in ref_seen:
            continue
        ref_seen.add(sig)
        obj.bsl_query_refs.append(ref)


def analyze_bsl(objects: Dict[str, ObjectInfo], config_root: str = "") -> None:
    """Analyze BSL for all parsed objects."""
    for obj in objects.values():
        analyze_bsl_for_object(obj, config_root=config_root)
