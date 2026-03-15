"""Static BSL analyzer for procedures, calls, and query references."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List, Set

from models import BSLCall, BSLProcedure, BSLQueryRef, ObjectInfo


_PROC_RE = re.compile(
    r"^\s*(?:Procedure|Процедура|Function|Функция)\s+([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*)\b",
    re.IGNORECASE,
)
_EXPORT_RE = re.compile(r"\b(?:Export|Экспорт)\b", re.IGNORECASE)
_CALL_RE = re.compile(
    r"(?<![\wА-Яа-яЁё])([A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*(?:\.[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*){1,2})\s*\(",
)
_QUERY_REF_RE = re.compile(
    r"\b("
    r"Catalog|Document|InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister|"
    r"Enum|ChartOfCharacteristicTypes|ChartOfAccounts|ChartOfCalculationTypes|BusinessProcess|Task|ExchangePlan"
    r")\.([A-Za-zА-Яа-яЁё0-9_]+)\b"
)
_QUERY_REF_RU_RE = re.compile(
    r"\b("
    r"Справочник|Документ|РегистрСведений|РегистрНакопления|РегистрБухгалтерии|РегистрРасчета|"
    r"Перечисление|ПланВидовХарактеристик|ПланСчетов|ПланВидовРасчета|БизнесПроцесс|Задача|ПланОбмена"
    r")\.([A-Za-zА-Яа-яЁё0-9_]+)\b"
)
_META_COLLECTIONS = {
    "Catalogs": "Catalog",
    "Справочники": "Catalog",
    "Documents": "Document",
    "Документы": "Document",
    "InformationRegisters": "InformationRegister",
    "РегистрыСведений": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "РегистрыНакопления": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "РегистрыБухгалтерии": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "РегистрыРасчета": "CalculationRegister",
    "Enums": "Enum",
    "Перечисления": "Enum",
    "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ПланыВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ChartOfAccounts": "ChartOfAccounts",
    "ПланыСчетов": "ChartOfAccounts",
    "ChartOfCalculationTypes": "ChartOfCalculationTypes",
    "ПланыВидовРасчета": "ChartOfCalculationTypes",
    "BusinessProcesses": "BusinessProcess",
    "БизнесПроцессы": "BusinessProcess",
    "Tasks": "Task",
    "Задачи": "Task",
    "ExchangePlans": "ExchangePlan",
    "ПланыОбмена": "ExchangePlan",
    "Reports": "Report",
    "Отчеты": "Report",
    "DataProcessors": "DataProcessor",
    "Обработки": "DataProcessor",
    "Constants": "Constant",
    "Константы": "Constant",
    "CommonModules": "CommonModule",
    "ОбщиеМодули": "CommonModule",
}
_RU_QUERY_TYPE_MAP = {
    "Справочник": "Catalog",
    "Документ": "Document",
    "РегистрСведений": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister",
    "РегистрРасчета": "CalculationRegister",
    "Перечисление": "Enum",
    "ПланВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ПланСчетов": "ChartOfAccounts",
    "ПланВидовРасчета": "ChartOfCalculationTypes",
    "БизнесПроцесс": "BusinessProcess",
    "Задача": "Task",
    "ПланОбмена": "ExchangePlan",
}


def _read_text(file_path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1251"):
        try:
            return file_path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return file_path.read_text(encoding="utf-8", errors="ignore")


def _iter_module_files(obj_info: ObjectInfo) -> Iterable[Path]:
    base_path = Path(obj_info.path)
    if not base_path.exists():
        return []
    files: List[Path] = []
    for path in base_path.rglob("*"):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix == ".bsl":
            files.append(path)
            continue
        if suffix == ".txt" and ("module" in path.stem.lower() or "ext" in {part.lower() for part in path.parts}):
            files.append(path)
    return sorted(files)


def _strip_inline_comment(line: str) -> str:
    if "//" not in line:
        return line
    return line.split("//", 1)[0]


def _extract_procedures(text: str, module_path: str) -> List[BSLProcedure]:
    procedures: List[BSLProcedure] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        match = _PROC_RE.search(line)
        if not match:
            continue
        procedures.append(
            BSLProcedure(
                name=match.group(1),
                line_number=line_number,
                is_function=bool(re.search(r"^\s*(?:Function|Функция)\b", line, re.IGNORECASE)),
                is_export=bool(_EXPORT_RE.search(line)),
                module_path=module_path,
            )
        )
    return procedures


def _extract_calls(text: str, module_path: str, object_index: Dict[str, ObjectInfo]) -> List[BSLCall]:
    known_common_modules: Set[str] = {obj.name for obj in object_index.values() if obj.obj_type == "CommonModule"}
    calls: List[BSLCall] = []
    seen = set()

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_inline_comment(raw_line)
        for match in _CALL_RE.finditer(line):
            expression = match.group(1)
            parts = expression.split(".")
            target_module = ""
            target_method = ""

            if parts[0] in _META_COLLECTIONS and len(parts) >= 2:
                mapped_type = _META_COLLECTIONS[parts[0]]
                if mapped_type == "CommonModule":
                    if len(parts) >= 3:
                        target_module = f"CommonModule.{parts[1]}"
                        target_method = parts[2]
                    else:
                        target_module = f"CommonModule.{parts[1]}"
                elif len(parts) >= 3:
                    target_module = f"{mapped_type}.{parts[1]}"
                    target_method = parts[2]
                else:
                    target_module = f"{mapped_type}.{parts[1]}"
            elif len(parts) == 2 and parts[0] in known_common_modules:
                target_module = f"CommonModule.{parts[0]}"
                target_method = parts[1]
            else:
                continue

            signature = (target_module, target_method, module_path, line_number)
            if signature in seen:
                continue
            seen.add(signature)
            calls.append(
                BSLCall(
                    target_module=target_module,
                    target_method=target_method,
                    source_module=module_path,
                    source_line=line_number,
                )
            )

    return calls


def _extract_query_refs(text: str, module_path: str) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    seen = set()
    lines = text.splitlines()

    for line_number, raw_line in enumerate(lines, start=1):
        line = _strip_inline_comment(raw_line)
        for match in _QUERY_REF_RE.finditer(line):
            signature = (match.group(1), match.group(2), line_number)
            if signature in seen:
                continue
            seen.add(signature)
            refs.append(
                BSLQueryRef(
                    obj_type=match.group(1),
                    obj_name=match.group(2),
                    source_module=module_path,
                    source_line=line_number,
                )
            )

        for match in _QUERY_REF_RU_RE.finditer(line):
            obj_type = _RU_QUERY_TYPE_MAP[match.group(1)]
            signature = (obj_type, match.group(2), line_number)
            if signature in seen:
                continue
            seen.add(signature)
            refs.append(
                BSLQueryRef(
                    obj_type=obj_type,
                    obj_name=match.group(2),
                    source_module=module_path,
                    source_line=line_number,
                )
            )

    return refs


def analyze_bsl_modules(config_path: str, object_index: Dict[str, ObjectInfo]) -> None:
    """Analyze all BSL modules for metadata objects."""

    config_root = Path(config_path).expanduser().resolve()
    for obj_info in object_index.values():
        procedures: List[BSLProcedure] = []
        calls: List[BSLCall] = []
        query_refs: List[BSLQueryRef] = []

        for module_file in _iter_module_files(obj_info):
            try:
                module_path = str(module_file.resolve().relative_to(config_root))
            except ValueError:
                module_path = str(module_file.resolve())
            text = _read_text(module_file)
            procedures.extend(_extract_procedures(text, module_path))
            calls.extend(_extract_calls(text, module_path, object_index))
            query_refs.extend(_extract_query_refs(text, module_path))

        obj_info.procedures = procedures
        obj_info.bsl_calls = calls
        obj_info.bsl_query_refs = query_refs
