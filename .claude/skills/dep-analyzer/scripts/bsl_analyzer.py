"""Статический анализ BSL-кода: процедуры, вызовы, обращения к метаданным, запросы."""

import os
import re
from typing import Dict, List, Optional

from models import (
    ObjectInfo, BSLProcedure, BSLCall, BSLQueryRef, DebugPoint,
)
from xml_helpers import get_type_folder

_RE_PROCEDURE = re.compile(
    r"^[ \t]*(?:(?:Async|Асинх)[ \t]+)?"
    r"(Процедура|Функция|Procedure|Function)"
    r"[ \t]+(\w+)"
    r"[ \t]*\(",
    re.MULTILINE | re.IGNORECASE,
)

_RE_EXPORT = re.compile(r"\bЭкспорт\b|\bExport\b", re.IGNORECASE)

_RE_ENDPROC = re.compile(
    r"^[ \t]*(КонецПроцедуры|КонецФункции|EndProcedure|EndFunction)",
    re.MULTILINE | re.IGNORECASE,
)

_RE_MODULE_CALL = re.compile(
    r"\b(\w+)\.(\w+)\s*\(",
    re.MULTILINE,
)

_RE_META_ACCESS_PATTERNS = [
    re.compile(r"\b(?:Справочники|Catalogs)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Документы|Documents)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрыСведений|InformationRegisters)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрыНакопления|AccumulationRegisters)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрыБухгалтерии|AccountingRegisters)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрыРасчёта|РегистрыРасчета|CalculationRegisters)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Перечисления|Enums)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Обработки|DataProcessors)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Отчёты|Отчеты|Reports)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланыОбмена|ExchangePlans)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:БизнесПроцессы|BusinessProcesses)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Задачи|Tasks)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Константы|Constants)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланыВидовХарактеристик|ChartsOfCharacteristicTypes)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланыСчетов|ChartsOfAccounts)\.(\w+)", re.IGNORECASE),
]

_META_ACCESS_TYPES = {
    "справочники": "Catalog", "catalogs": "Catalog",
    "документы": "Document", "documents": "Document",
    "регистрысведений": "InformationRegister", "informationregisters": "InformationRegister",
    "регистрынакопления": "AccumulationRegister", "accumulationregisters": "AccumulationRegister",
    "регистрыбухгалтерии": "AccountingRegister", "accountingregisters": "AccountingRegister",
    "регистрырасчёта": "CalculationRegister", "регистрырасчета": "CalculationRegister",
    "calculationregisters": "CalculationRegister",
    "перечисления": "Enum", "enums": "Enum",
    "обработки": "DataProcessor", "dataprocessors": "DataProcessor",
    "отчёты": "Report", "отчеты": "Report", "reports": "Report",
    "планыобмена": "ExchangePlan", "exchangeplans": "ExchangePlan",
    "бизнеспроцессы": "BusinessProcess", "businessprocesses": "BusinessProcess",
    "задачи": "Task", "tasks": "Task",
    "константы": "Constant", "constants": "Constant",
    "планывидовхарактеристик": "ChartOfCharacteristicTypes",
    "chartsofcharacteristictypes": "ChartOfCharacteristicTypes",
    "планысчетов": "ChartOfAccounts", "chartsofaccounts": "ChartOfAccounts",
}

_RE_QUERY_START = re.compile(
    r"""(?:Новый\s+Запрос|New\s+Query)\s*(?:\(|;)""",
    re.IGNORECASE | re.MULTILINE,
)

_RE_QUERY_TEXT_ASSIGNMENT = re.compile(
    r"""\.(?:Текст|Text)\s*=\s*["\u0022]""",
    re.IGNORECASE | re.MULTILINE,
)

_RE_QUERY_REFS = [
    re.compile(r"\b(?:Справочник|Catalog)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Документ|Document)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрСведений|InformationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрНакопления|AccumulationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрБухгалтерии|AccountingRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:РегистрРасчёта|РегистрРасчета|CalculationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Перечисление|Enum)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланОбмена|ExchangePlan)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланВидовХарактеристик|ChartOfCharacteristicTypes)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:ПланСчетов|ChartOfAccounts)\.(\w+)", re.IGNORECASE),
    re.compile(r"\b(?:Константа|Constant)\.(\w+)", re.IGNORECASE),
]

_QUERY_REF_TYPES = {
    "справочник": "Catalog", "catalog": "Catalog",
    "документ": "Document", "document": "Document",
    "регистрсведений": "InformationRegister", "informationregister": "InformationRegister",
    "регистрнакопления": "AccumulationRegister", "accumulationregister": "AccumulationRegister",
    "регистрбухгалтерии": "AccountingRegister", "accountingregister": "AccountingRegister",
    "регистррасчёта": "CalculationRegister", "регистррасчета": "CalculationRegister",
    "calculationregister": "CalculationRegister",
    "перечисление": "Enum", "enum": "Enum",
    "планобмена": "ExchangePlan", "exchangeplan": "ExchangePlan",
    "планвидовхарактеристик": "ChartOfCharacteristicTypes",
    "chartofcharacteristictypes": "ChartOfCharacteristicTypes",
    "плансчетов": "ChartOfAccounts", "chartofaccounts": "ChartOfAccounts",
    "константа": "Constant", "constant": "Constant",
}


def analyze_bsl(obj_info: ObjectInfo) -> ObjectInfo:
    """Анализ всех BSL-модулей объекта."""
    bsl_files = _find_bsl_files(obj_info)

    for bsl_path in bsl_files:
        try:
            with open(bsl_path, "r", encoding="utf-8-sig") as f:
                content = f.read()
        except (UnicodeDecodeError, OSError):
            try:
                with open(bsl_path, "r", encoding="cp1251") as f:
                    content = f.read()
            except Exception:
                continue

        rel_path = os.path.relpath(bsl_path, obj_info.path) if obj_info.path else bsl_path

        _extract_procedures(obj_info, content, rel_path)
        _extract_calls(obj_info, content, rel_path)
        _extract_meta_access(obj_info, content, rel_path)
        _extract_query_refs(obj_info, content, rel_path)

    return obj_info


def analyze_all_bsl(objects: Dict[str, ObjectInfo]) -> Dict[str, ObjectInfo]:
    """Анализ BSL для всех объектов."""
    for key, obj in objects.items():
        analyze_bsl(obj)
    return objects


def get_debug_points(obj_info: ObjectInfo) -> List[DebugPoint]:
    """Получить точки остановки для отладки объекта."""
    points: List[DebugPoint] = []

    for proc in obj_info.procedures:
        context = ""
        if proc.is_export:
            context = "Экспортная процедура"
        if "ОбработкаПроведения" in proc.name or "Posting" in proc.name:
            context = "Проведение документа"
        elif "ПередЗаписью" in proc.name or "BeforeWrite" in proc.name:
            context = "Перед записью"
        elif "ПриЗаписи" in proc.name or "OnWrite" in proc.name:
            context = "При записи"
        elif "ПриСозданииНаСервере" in proc.name or "OnCreateAtServer" in proc.name:
            context = "Создание формы на сервере"

        points.append(DebugPoint(
            procedure_name=proc.name,
            module_path=proc.module_path,
            line_number=proc.line_number,
            context=context,
            exists=True,
            source_object=obj_info.name,
            source_type=obj_info.obj_type,
        ))

    return points


def get_all_debug_points(objects: Dict[str, ObjectInfo]) -> List[DebugPoint]:
    """Получить точки остановки для всех объектов."""
    all_points: List[DebugPoint] = []
    for key, obj in objects.items():
        all_points.extend(get_debug_points(obj))
    return all_points


def _find_bsl_files(obj_info: ObjectInfo) -> List[str]:
    """Найти все .bsl файлы объекта."""
    bsl_files = []
    if not obj_info.path or not os.path.exists(obj_info.path):
        return bsl_files

    if os.path.isdir(obj_info.path):
        for root, dirs, files in os.walk(obj_info.path):
            for f in files:
                if f.lower().endswith(".bsl"):
                    bsl_files.append(os.path.join(root, f))
    return bsl_files


def _extract_procedures(obj_info: ObjectInfo, content: str, rel_path: str):
    """Извлечь процедуры и функции из BSL-кода."""
    lines = content.split("\n")

    for match in _RE_PROCEDURE.finditer(content):
        kind = match.group(1).lower()
        name = match.group(2)
        line_num = content[:match.start()].count("\n") + 1

        is_function = kind in ("функция", "function")

        proc_start = match.start()
        proc_end_match = None
        for em in _RE_ENDPROC.finditer(content, proc_start + 1):
            proc_end_match = em
            break

        proc_text = ""
        if proc_end_match:
            first_line_end = content.find("\n", match.start())
            if first_line_end == -1:
                first_line_end = len(content)
            proc_text = content[match.start():first_line_end]
        else:
            proc_text = match.group(0)

        is_export = bool(_RE_EXPORT.search(proc_text))

        obj_info.procedures.append(BSLProcedure(
            name=name,
            line_number=line_num,
            is_function=is_function,
            is_export=is_export,
            module_path=rel_path,
        ))


def _extract_calls(obj_info: ObjectInfo, content: str, rel_path: str):
    """Извлечь вызовы модулей из BSL-кода."""
    seen = set()
    for match in _RE_MODULE_CALL.finditer(content):
        module_name = match.group(1)
        method_name = match.group(2)
        line_num = content[:match.start()].count("\n") + 1

        if module_name.lower() in _META_ACCESS_TYPES:
            continue

        key = (module_name, method_name)
        if key in seen:
            continue
        seen.add(key)

        obj_info.bsl_calls.append(BSLCall(
            target_module=module_name,
            target_method=method_name,
            source_module=rel_path,
            source_line=line_num,
        ))


def _extract_meta_access(obj_info: ObjectInfo, content: str, rel_path: str):
    """Извлечь обращения к метаданным из BSL-кода."""
    seen = set()

    for i, pattern in enumerate(_RE_META_ACCESS_PATTERNS):
        for match in pattern.finditer(content):
            full_match = match.group(0)
            manager_part = full_match.split(".")[0].lower()
            obj_name = match.group(1)

            obj_type = _META_ACCESS_TYPES.get(manager_part, "")
            if not obj_type:
                continue

            key = (obj_type, obj_name)
            if key in seen:
                continue
            seen.add(key)
            line_num = content[:match.start()].count("\n") + 1

            obj_info.bsl_calls.append(BSLCall(
                target_module=f"{obj_type}.{obj_name}",
                target_method="",
                source_module=rel_path,
                source_line=line_num,
            ))


def _extract_query_refs(obj_info: ObjectInfo, content: str, rel_path: str):
    """Извлечь ссылки на объекты из текстов запросов в BSL-коде."""
    seen = set()
    query_strings = _find_query_strings(content)

    for query_text, base_line in query_strings:
        for pattern in _RE_QUERY_REFS:
            for match in pattern.finditer(query_text):
                full_match = match.group(0)
                type_part = full_match.split(".")[0].lower()
                obj_name = match.group(1)

                obj_type = _QUERY_REF_TYPES.get(type_part, "")
                if not obj_type:
                    continue

                key = (obj_type, obj_name)
                if key in seen:
                    continue
                seen.add(key)

                line_offset = query_text[:match.start()].count("\n")

                obj_info.bsl_query_refs.append(BSLQueryRef(
                    obj_type=obj_type,
                    obj_name=obj_name,
                    source_module=rel_path,
                    source_line=base_line + line_offset,
                ))


def _find_query_strings(content: str) -> List[tuple]:
    """Найти текстовые литералы, которые вероятно содержат текст запроса.
    Returns: list of (query_text, line_number)."""
    results = []

    in_multiline = False
    multiline_start = 0
    multiline_parts = []

    lines = content.split("\n")
    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        if stripped.startswith("|") or stripped.startswith("\""):
            if not in_multiline:
                in_multiline = True
                multiline_start = i
                multiline_parts = []

            clean = stripped.lstrip("|").lstrip("\"").rstrip("\"").rstrip("|")
            multiline_parts.append(clean)
        else:
            if in_multiline and multiline_parts:
                full_text = "\n".join(multiline_parts)
                if _looks_like_query(full_text):
                    results.append((full_text, multiline_start))
                in_multiline = False
                multiline_parts = []

    if in_multiline and multiline_parts:
        full_text = "\n".join(multiline_parts)
        if _looks_like_query(full_text):
            results.append((full_text, multiline_start))

    return results


def _looks_like_query(text: str) -> bool:
    """Проверить, похож ли текст на запрос 1С."""
    query_keywords = [
        "ВЫБРАТЬ", "SELECT", "ИЗ", "FROM", "ГДЕ", "WHERE",
        "СОЕДИНЕНИЕ", "JOIN", "СГРУППИРОВАТЬ", "GROUP",
    ]
    upper = text.upper()
    return any(kw in upper for kw in query_keywords)
