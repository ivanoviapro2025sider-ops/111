"""Статический анализ BSL-кода: процедуры, вызовы, обращения к метаданным, запросы."""

import os
import re
from typing import List, Optional, Tuple

from models import BSLProcedure, BSLCall, BSLQueryRef, ObjectInfo


_RE_PROCEDURE = re.compile(
    r"^\s*(?:Процедура|Procedure)\s+(\w+)\s*\(",
    re.IGNORECASE | re.MULTILINE,
)
_RE_FUNCTION = re.compile(
    r"^\s*(?:Функция|Function)\s+(\w+)\s*\(",
    re.IGNORECASE | re.MULTILINE,
)
_RE_EXPORT = re.compile(r"\)\s*(?:Экспорт|Export)\s*$", re.IGNORECASE | re.MULTILINE)

_RE_END_PROCEDURE = re.compile(
    r"^\s*(?:КонецПроцедуры|EndProcedure)\s*$",
    re.IGNORECASE | re.MULTILINE,
)
_RE_END_FUNCTION = re.compile(
    r"^\s*(?:КонецФункции|EndFunction)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

_META_ACCESSORS_RU = [
    "Справочники", "Документы", "Перечисления", "Обработки", "Отчёты", "Отчеты",
    "РегистрыСведений", "РегистрыНакопления", "РегистрыБухгалтерии", "РегистрыРасчёта",
    "РегистрыРасчета", "ПланыВидовХарактеристик", "ПланыСчетов",
    "ПланыВидовРасчёта", "ПланыВидовРасчета", "ПланыОбмена",
    "БизнесПроцессы", "Задачи", "Константы",
]
_META_ACCESSORS_EN = [
    "Catalogs", "Documents", "Enums", "DataProcessors", "Reports",
    "InformationRegisters", "AccumulationRegisters", "AccountingRegisters",
    "CalculationRegisters", "ChartsOfCharacteristicTypes", "ChartsOfAccounts",
    "ChartsOfCalculationTypes", "ExchangePlans",
    "BusinessProcesses", "Tasks", "Constants",
]

_ACCESSOR_TO_TYPE = {
    "Справочники": "Catalog", "Catalogs": "Catalog",
    "Документы": "Document", "Documents": "Document",
    "Перечисления": "Enum", "Enums": "Enum",
    "Обработки": "DataProcessor", "DataProcessors": "DataProcessor",
    "Отчёты": "Report", "Отчеты": "Report", "Reports": "Report",
    "РегистрыСведений": "InformationRegister", "InformationRegisters": "InformationRegister",
    "РегистрыНакопления": "AccumulationRegister", "AccumulationRegisters": "AccumulationRegister",
    "РегистрыБухгалтерии": "AccountingRegister", "AccountingRegisters": "AccountingRegister",
    "РегистрыРасчёта": "CalculationRegister", "РегистрыРасчета": "CalculationRegister",
    "CalculationRegisters": "CalculationRegister",
    "ПланыВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ChartsOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ПланыСчетов": "ChartOfAccounts", "ChartsOfAccounts": "ChartOfAccounts",
    "ПланыВидовРасчёта": "ChartOfCalculationTypes", "ПланыВидовРасчета": "ChartOfCalculationTypes",
    "ChartsOfCalculationTypes": "ChartOfCalculationTypes",
    "ПланыОбмена": "ExchangePlan", "ExchangePlans": "ExchangePlan",
    "БизнесПроцессы": "BusinessProcess", "BusinessProcesses": "BusinessProcess",
    "Задачи": "Task", "Tasks": "Task",
    "Константы": "Constant", "Constants": "Constant",
}

_ALL_ACCESSORS = _META_ACCESSORS_RU + _META_ACCESSORS_EN
_RE_META_ACCESS = re.compile(
    r"\b(" + "|".join(re.escape(a) for a in _ALL_ACCESSORS) + r")\.(\w+)"
)

_RE_COMMON_MODULE_CALL = re.compile(
    r"\b(\w+)\.(\w+)\s*\("
)

_QUERY_OBJECT_PATTERNS = [
    re.compile(r"(?:Справочник|Catalog)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:Документ|Document)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:РегистрСведений|InformationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:РегистрНакопления|AccumulationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:РегистрБухгалтерии|AccountingRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:РегистрРасчёта|РегистрРасчета|CalculationRegister)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:Перечисление|Enum)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:ПланВидовХарактеристик|ChartOfCharacteristicTypes)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:ПланСчетов|ChartOfAccounts)\.(\w+)", re.IGNORECASE),
    re.compile(r"(?:ПланОбмена|ExchangePlan)\.(\w+)", re.IGNORECASE),
]

_QUERY_TYPE_MAP = {
    "Справочник": "Catalog", "Catalog": "Catalog",
    "Документ": "Document", "Document": "Document",
    "РегистрСведений": "InformationRegister", "InformationRegister": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister", "AccumulationRegister": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister", "AccountingRegister": "AccountingRegister",
    "РегистрРасчёта": "CalculationRegister", "РегистрРасчета": "CalculationRegister",
    "CalculationRegister": "CalculationRegister",
    "Перечисление": "Enum", "Enum": "Enum",
    "ПланВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ПланСчетов": "ChartOfAccounts", "ChartOfAccounts": "ChartOfAccounts",
    "ПланОбмена": "ExchangePlan", "ExchangePlan": "ExchangePlan",
}

_RE_QUERY_BLOCK = re.compile(
    r'(?:(?:Новый\s+Запрос|New\s+Query)\s*[;(]|\.(?:Текст|Text)\s*=\s*")',
    re.IGNORECASE,
)

_RE_STRING_LITERAL = re.compile(r'"([^"]*)"', re.DOTALL)


def analyze_bsl_file(
    bsl_path: str,
    module_rel_path: str = "",
) -> Tuple[List[BSLProcedure], List[BSLCall], List[BSLQueryRef]]:
    """Анализировать один BSL-файл.

    Returns: (procedures, calls, query_refs)
    """
    if not os.path.exists(bsl_path):
        return [], [], []

    try:
        with open(bsl_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except Exception:
        try:
            with open(bsl_path, "r", encoding="cp1251") as f:
                content = f.read()
        except Exception:
            return [], [], []

    if not module_rel_path:
        module_rel_path = bsl_path

    procedures = _extract_procedures(content, module_rel_path)
    calls = _extract_calls(content, module_rel_path)
    query_refs = _extract_query_refs(content, module_rel_path)

    return procedures, calls, query_refs


def analyze_object_bsl(config_path: str, obj_info: ObjectInfo) -> ObjectInfo:
    """Найти и проанализировать все BSL-модули объекта."""
    from scanner import find_bsl_modules

    obj_path = obj_info.path
    if not obj_path or not os.path.isdir(obj_path):
        return obj_info

    bsl_files = find_bsl_modules(obj_path)

    for bsl_path in bsl_files:
        try:
            rel_path = os.path.relpath(bsl_path, config_path)
        except ValueError:
            rel_path = bsl_path

        procedures, calls, query_refs = analyze_bsl_file(bsl_path, rel_path)
        obj_info.procedures.extend(procedures)
        obj_info.bsl_calls.extend(calls)
        obj_info.bsl_query_refs.extend(query_refs)

    return obj_info


def _extract_procedures(content: str, module_path: str) -> List[BSLProcedure]:
    """Извлечь все процедуры и функции из BSL-кода."""
    result: List[BSLProcedure] = []
    lines = content.split("\n")

    for i, line in enumerate(lines, start=1):
        is_func = False

        m = _RE_PROCEDURE.match(line)
        if not m:
            m = _RE_FUNCTION.match(line)
            if m:
                is_func = True

        if m:
            name = m.group(1)
            is_export = bool(_RE_EXPORT.search(line))
            result.append(BSLProcedure(
                name=name,
                line_number=i,
                is_function=is_func,
                is_export=is_export,
                module_path=module_path,
            ))

    return result


def _extract_calls(content: str, module_path: str) -> List[BSLCall]:
    """Извлечь вызовы модулей и обращения к метаданным."""
    result: List[BSLCall] = []
    seen = set()
    lines = content.split("\n")

    for i, line in enumerate(lines, start=1):
        stripped = line.split("//")[0]

        for m in _RE_META_ACCESS.finditer(stripped):
            accessor = m.group(1)
            obj_name = m.group(2)
            obj_type = _ACCESSOR_TO_TYPE.get(accessor, accessor)

            after = stripped[m.end():]
            method = ""
            method_match = re.match(r"\s*\.\s*(\w+)", after)
            if method_match:
                method = method_match.group(1)

            key = (obj_type, obj_name, method, module_path, i)
            if key not in seen:
                seen.add(key)
                result.append(BSLCall(
                    target_module=f"{obj_type}.{obj_name}",
                    target_method=method,
                    source_module=module_path,
                    source_line=i,
                ))

        for m in _RE_COMMON_MODULE_CALL.finditer(stripped):
            module_name = m.group(1)
            method_name = m.group(2)

            if module_name in _ACCESSOR_TO_TYPE:
                continue
            if module_name.lower() in _SKIP_MODULES:
                continue

            key = (module_name, method_name, module_path, i)
            if key not in seen:
                seen.add(key)
                result.append(BSLCall(
                    target_module=module_name,
                    target_method=method_name,
                    source_module=module_path,
                    source_line=i,
                ))

    return result


_SKIP_MODULES = {
    "этотобъект", "thisobject", "элементыформы", "formitems", "items",
    "объект", "object", "запрос", "query", "таблица", "table",
    "строка", "string", "число", "number", "дата", "date",
    "массив", "array", "список", "list", "соответствие", "map",
    "структура", "structure", "новый", "new",
    "выборка", "selection", "результат", "result",
    "текстовыйдокумент", "textdocument", "табличныйдокумент", "spreadsheетdocument",
    "типописания", "typedescription",
    "значениезаполнения", "fillingvalue",
}


def _extract_query_refs(content: str, module_path: str) -> List[BSLQueryRef]:
    """Извлечь ссылки на объекты метаданных из текстов запросов."""
    result: List[BSLQueryRef] = []
    seen = set()

    query_strings = _find_query_strings(content)

    for query_text, approx_line in query_strings:
        for pattern in _QUERY_OBJECT_PATTERNS:
            for m in pattern.finditer(query_text):
                full_match = m.group(0)
                obj_name = m.group(1)

                type_part = full_match.split(".")[0]
                obj_type = _QUERY_TYPE_MAP.get(type_part, type_part)

                key = (obj_type, obj_name)
                if key not in seen:
                    seen.add(key)
                    result.append(BSLQueryRef(
                        obj_type=obj_type,
                        obj_name=obj_name,
                        source_module=module_path,
                        source_line=approx_line,
                    ))

    return result


def _find_query_strings(content: str) -> List[Tuple[str, int]]:
    """Найти все строковые литералы, которые могут содержать запросы."""
    result: List[Tuple[str, int]] = []
    lines = content.split("\n")

    in_multiline = False
    current_string = ""
    start_line = 0

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()

        if in_multiline:
            if stripped.startswith("|"):
                current_string += "\n" + stripped[1:]
            elif stripped.endswith('";') or stripped.endswith('"'):
                current_string += "\n" + stripped.rstrip('";').rstrip('"')
                if _looks_like_query(current_string):
                    result.append((current_string, start_line))
                in_multiline = False
                current_string = ""
            else:
                if current_string and _looks_like_query(current_string):
                    result.append((current_string, start_line))
                in_multiline = False
                current_string = ""
            continue

        for m in _RE_STRING_LITERAL.finditer(stripped):
            text = m.group(1)
            if _looks_like_query(text):
                result.append((text, i))

        if stripped.endswith('|"') or ('"' in stripped and not stripped.endswith('"')):
            quote_idx = stripped.rfind('"')
            if quote_idx > 0:
                candidate = stripped[:quote_idx]
                last_open = candidate.rfind('"')
                if last_open >= 0:
                    partial = candidate[last_open + 1:]
                    if _looks_like_query_start(partial):
                        in_multiline = True
                        current_string = partial
                        start_line = i

    return result


def _looks_like_query(text: str) -> bool:
    """Эвристика: содержит ли строка текст запроса 1С."""
    upper = text.upper()
    query_keywords = ["ВЫБРАТЬ", "SELECT", "ИЗ", "FROM", "ГДЕ", "WHERE"]
    count = sum(1 for kw in query_keywords if kw in upper)
    return count >= 2


def _looks_like_query_start(text: str) -> bool:
    upper = text.strip().upper()
    return any(upper.startswith(kw) for kw in ["ВЫБРАТЬ", "SELECT"])
