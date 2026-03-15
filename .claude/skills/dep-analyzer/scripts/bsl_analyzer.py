"""Static BSL analyzer for procedures, calls, metadata access, and query refs."""

from __future__ import annotations

import os
import re
from typing import Iterable, List

from models import BSLCall, BSLProcedure, BSLQueryRef, ObjectInfo, ReferenceInfo

_PROC_RE = re.compile(
    r"^\s*(?:Процедура|Procedure|Функция|Function)\s+([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\((.*?)\)\s*(?:Экспорт|Export)?",
    re.IGNORECASE,
)
_FUNC_RE = re.compile(r"^\s*(?:Функция|Function)\b", re.IGNORECASE)
_EXPORT_RE = re.compile(r"\b(?:Экспорт|Export)\b", re.IGNORECASE)
_CALL_RE = re.compile(r"(?<![\w.])([A-Za-zА-Яа-я_][\wА-Яа-я]*)\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\(")
_STRING_RE = re.compile(r'"((?:[^"]|"")*)"')

_META_PREFIXES = {
    "Catalogs": "Catalog",
    "Documents": "Document",
    "InformationRegisters": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "Enums": "Enum",
    "Reports": "Report",
    "DataProcessors": "DataProcessor",
    "BusinessProcesses": "BusinessProcess",
    "Tasks": "Task",
    "ExchangePlans": "ExchangePlan",
    "Constants": "Constant",
    "DocumentJournals": "DocumentJournal",
    "ScheduledJobs": "ScheduledJob",
    "DefinedTypes": "DefinedType",
    "HTTPServices": "HTTPService",
    "WebServices": "WebService",
    "ChartsOfAccounts": "ChartOfAccounts",
    "ChartsOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ChartsOfCalculationTypes": "ChartOfCalculationTypes",
    "Справочники": "Catalog",
    "Документы": "Document",
    "РегистрыСведений": "InformationRegister",
    "РегистрыНакопления": "AccumulationRegister",
    "РегистрыБухгалтерии": "AccountingRegister",
    "РегистрыРасчета": "CalculationRegister",
    "Перечисления": "Enum",
    "Отчеты": "Report",
    "Обработки": "DataProcessor",
    "БизнесПроцессы": "BusinessProcess",
    "Задачи": "Task",
    "ПланыОбмена": "ExchangePlan",
    "Константы": "Constant",
    "ЖурналыДокументов": "DocumentJournal",
    "РегламентныеЗадания": "ScheduledJob",
    "ОпределяемыеТипы": "DefinedType",
    "HTTPСервисы": "HTTPService",
    "ВебСервисы": "WebService",
    "ПланыСчетов": "ChartOfAccounts",
    "ПланыВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ПланыВидовРасчета": "ChartOfCalculationTypes",
}

_QUERY_PREFIXES = {
    "Catalog": "Catalog",
    "Document": "Document",
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
    "ChartOfAccounts": "ChartOfAccounts",
    "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ChartOfCalculationTypes": "ChartOfCalculationTypes",
    "BusinessProcess": "BusinessProcess",
    "Task": "Task",
    "ExchangePlan": "ExchangePlan",
    "Справочник": "Catalog",
    "Документ": "Document",
    "РегистрСведений": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister",
    "РегистрРасчета": "CalculationRegister",
    "ПланСчетов": "ChartOfAccounts",
    "ПланВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ПланВидовРасчета": "ChartOfCalculationTypes",
    "БизнесПроцесс": "BusinessProcess",
    "Задача": "Task",
    "ПланОбмена": "ExchangePlan",
}

_META_RE = re.compile(
    r"(?<![\w.])(" + "|".join(re.escape(prefix) for prefix in sorted(_META_PREFIXES, key=len, reverse=True)) + r")\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"
)
_QUERY_RE = re.compile(
    r"(?<![\w.])(" + "|".join(re.escape(prefix) for prefix in sorted(_QUERY_PREFIXES, key=len, reverse=True)) + r")\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)"
)


def _iter_bsl_files(obj: ObjectInfo) -> Iterable[str]:
    if not obj.path or not os.path.isdir(obj.path):
        return []
    files: List[str] = []
    for current_root, _, file_names in os.walk(obj.path):
        for file_name in sorted(file_names):
            if file_name.lower().endswith(".bsl"):
                files.append(os.path.join(current_root, file_name))
    return files


def _relative_path(path: str, root_dir: str) -> str:
    try:
        return os.path.relpath(path, root_dir)
    except ValueError:
        return path


def _extract_query_refs(line: str, module_path: str, line_number: int) -> List[BSLQueryRef]:
    refs: List[BSLQueryRef] = []
    for literal in _STRING_RE.findall(line):
        text = literal.replace('""', '"')
        for prefix, obj_name in _QUERY_RE.findall(text):
            refs.append(
                BSLQueryRef(
                    obj_type=_QUERY_PREFIXES[prefix],
                    obj_name=obj_name,
                    source_module=module_path,
                    source_line=line_number,
                )
            )
    return refs


def _append_meta_accesses(obj: ObjectInfo, line: str, line_number: int) -> None:
    for prefix, obj_name in _META_RE.findall(line):
        obj.references.append(
            ReferenceInfo(
                source_attribute=f"BSL:{line_number}",
                target_type=_META_PREFIXES[prefix],
                target_name=obj_name,
                ref_kind="bsl_meta_access",
            )
        )


def _append_calls(obj: ObjectInfo, line: str, module_path: str, line_number: int) -> None:
    for target_module, target_method in _CALL_RE.findall(line):
        obj.bsl_calls.append(
            BSLCall(
                target_module=target_module,
                target_method=target_method,
                source_module=module_path,
                source_line=line_number,
            )
        )


def _append_procedure(obj: ObjectInfo, line: str, module_path: str, line_number: int) -> None:
    match = _PROC_RE.search(line)
    if not match:
        return
    obj.procedures.append(
        BSLProcedure(
            name=match.group(1),
            line_number=line_number,
            is_function=bool(_FUNC_RE.search(line)),
            is_export=bool(_EXPORT_RE.search(line)),
            module_path=module_path,
        )
    )


def analyze_bsl(objects: Iterable[ObjectInfo], root_dir: str) -> List[ObjectInfo]:
    for obj in objects:
        module_files = list(_iter_bsl_files(obj))
        if module_files:
            obj.properties["module_files"] = ";".join(_relative_path(path, root_dir) for path in module_files)
        for file_path in module_files:
            module_path = _relative_path(file_path, root_dir)
            try:
                with open(file_path, "r", encoding="utf-8-sig") as handle:
                    lines = handle.readlines()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="cp1251", errors="ignore") as handle:
                    lines = handle.readlines()

            for line_number, line in enumerate(lines, start=1):
                _append_procedure(obj, line, module_path, line_number)
                _append_calls(obj, line, module_path, line_number)
                _append_meta_accesses(obj, line, line_number)
                obj.bsl_query_refs.extend(_extract_query_refs(line, module_path, line_number))
    return list(objects)
