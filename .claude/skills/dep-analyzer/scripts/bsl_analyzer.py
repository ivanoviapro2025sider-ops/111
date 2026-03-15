"""Статический анализ BSL-модулей: процедуры, вызовы, доступ к метаданным и точки отладки."""

from __future__ import annotations

import os
import re
from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Tuple

from models import BSLCall, BSLProcedure, BSLQueryRef, DebugPoint, ObjectInfo

PROCEDURE_PATTERN = re.compile(
    r"^\s*(?:Procedure|Function|Процедура|Функция)\s+([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*(?:\(|$)(.*)$",
    re.IGNORECASE,
)

CALL_PATTERN = re.compile(
    r"(?<![\w.])([A-Za-zА-Яа-я_][\wА-Яа-я]*(?:\.[A-Za-zА-Яа-я_][\wА-Яа-я]*)+)\s*\(",
    re.UNICODE,
)

STRING_PATTERN = re.compile(r'"([^"\n]*(?:""[^"\n]*)*)"')

META_ACCESS_PATTERN = re.compile(
    r"\b("
    r"Catalogs|Documents|Enums|InformationRegisters|AccumulationRegisters|AccountingRegisters|CalculationRegisters|"
    r"BusinessProcesses|Tasks|ExchangePlans|Constants|CommonModules|Catalog|Document|Enum|InformationRegister|"
    r"AccumulationRegister|AccountingRegister|CalculationRegister|BusinessProcess|Task|ExchangePlan|Constant|"
    r"Справочники|Документы|Перечисления|РегистрыСведений|РегистрыНакопления|РегистрыБухгалтерии|РегистрыРасчета|"
    r"БизнесПроцессы|Задачи|ПланыОбмена|Константы|ОбщиеМодули|Справочник|Документ|Перечисление|"
    r"РегистрСведений|РегистрНакопления|РегистрБухгалтерии|РегистрРасчета"
    r")\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)",
    re.UNICODE,
)

QUERY_REF_PATTERN = re.compile(
    r"\b("
    r"Catalog|Document|InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister|Enum|"
    r"BusinessProcess|Task|ExchangePlan|Constant|Справочник|Документ|РегистрСведений|РегистрНакопления|"
    r"РегистрБухгалтерии|РегистрРасчета|Перечисление|БизнесПроцесс|Задача|ПланОбмена|Константа"
    r")\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)",
    re.UNICODE,
)

KEYWORDS = {
    "if",
    "then",
    "for",
    "while",
    "try",
    "except",
    "return",
    "new",
    "not",
    "and",
    "or",
    "endif",
    "enddo",
    "Процедура",
    "Функция",
    "Если",
    "Тогда",
    "Для",
    "Пока",
    "Попытка",
    "Исключение",
    "Возврат",
    "Новый",
    "Не",
    "И",
    "Или",
    "КонецЕсли",
    "КонецЦикла",
}

META_PREFIX_TO_TYPE = {
    "Catalogs": "Catalog",
    "Documents": "Document",
    "Enums": "Enum",
    "InformationRegisters": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "BusinessProcesses": "BusinessProcess",
    "Tasks": "Task",
    "ExchangePlans": "ExchangePlan",
    "Constants": "Constant",
    "CommonModules": "CommonModule",
    "Catalog": "Catalog",
    "Document": "Document",
    "Enum": "Enum",
    "InformationRegister": "InformationRegister",
    "AccumulationRegister": "AccumulationRegister",
    "AccountingRegister": "AccountingRegister",
    "CalculationRegister": "CalculationRegister",
    "BusinessProcess": "BusinessProcess",
    "Task": "Task",
    "ExchangePlan": "ExchangePlan",
    "Constant": "Constant",
    "Справочники": "Catalog",
    "Документы": "Document",
    "Перечисления": "Enum",
    "РегистрыСведений": "InformationRegister",
    "РегистрыНакопления": "AccumulationRegister",
    "РегистрыБухгалтерии": "AccountingRegister",
    "РегистрыРасчета": "CalculationRegister",
    "БизнесПроцессы": "BusinessProcess",
    "Задачи": "Task",
    "ПланыОбмена": "ExchangePlan",
    "Константы": "Constant",
    "ОбщиеМодули": "CommonModule",
    "Справочник": "Catalog",
    "Документ": "Document",
    "Перечисление": "Enum",
    "РегистрСведений": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister",
    "РегистрРасчета": "CalculationRegister",
    "БизнесПроцесс": "BusinessProcess",
    "Задача": "Task",
    "ПланОбмена": "ExchangePlan",
    "Константа": "Constant",
}

DOCUMENT_DEBUG_ALIASES = {
    "Проведение документа": ["ОбработкаПроведения", "Posting"],
    "Отмена проведения": ["ОбработкаУдаленияПроведения", "UndoPosting"],
    "Перед записью": ["ПередЗаписью", "BeforeWrite"],
    "При записи": ["ПриЗаписи", "OnWrite", "AfterWrite"],
}


def _read_text(file_path: str) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            with open(file_path, "r", encoding=encoding) as handle:
                return handle.read()
        except UnicodeDecodeError:
            continue
        except FileNotFoundError:
            return ""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read()


def _iter_module_paths(obj_info: ObjectInfo, config_root: str) -> Iterable[str]:
    configured = obj_info.properties.get("module_paths", "").strip()
    if configured:
        for item in configured.split(","):
            normalized = item.strip()
            if normalized:
                yield normalized
        return

    if not obj_info.path or not os.path.isdir(obj_info.path):
        return
    for root, _dirs, files in os.walk(obj_info.path):
        for file_name in files:
            if file_name.lower().endswith(".bsl"):
                yield os.path.relpath(os.path.join(root, file_name), config_root)


def _strip_comments(line: str) -> str:
    return line.split("//", 1)[0]


def _extract_procedures(text: str, module_path: str) -> List[BSLProcedure]:
    procedures: List[BSLProcedure] = []
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_comments(raw_line)
        match = PROCEDURE_PATTERN.match(line)
        if not match:
            continue
        tail = match.group(2) or ""
        lower_line = line.lower()
        procedures.append(
            BSLProcedure(
                name=match.group(1),
                line_number=line_number,
                is_function=lower_line.lstrip().startswith(("function", "функция")),
                is_export=(" export" in lower_line) or (" экспорт" in lower_line) or ("export" in tail.lower()) or ("экспорт" in tail.lower()),
                module_path=module_path,
            )
        )
    return procedures


def _extract_calls(text: str, source_module: str) -> List[BSLCall]:
    calls: List[BSLCall] = []
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_comments(raw_line)
        if PROCEDURE_PATTERN.match(line):
            continue
        for match in CALL_PATTERN.finditer(line):
            chain = match.group(1)
            parts = chain.split(".")
            if len(parts) < 2:
                continue
            if parts[0] in KEYWORDS:
                continue
            calls.append(
                BSLCall(
                    target_module=".".join(parts[:-1]),
                    target_method=parts[-1],
                    source_module=source_module,
                    source_line=line_number,
                )
            )
    return calls


def _extract_meta_refs(text: str, source_module: str) -> Tuple[List[BSLCall], List[BSLQueryRef]]:
    meta_calls: List[BSLCall] = []
    query_refs: List[BSLQueryRef] = []
    seen_calls = set()
    seen_refs = set()

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = _strip_comments(raw_line)

        for match in META_ACCESS_PATTERN.finditer(line):
            prefix, name = match.groups()
            obj_type = META_PREFIX_TO_TYPE.get(prefix, prefix)
            method = ""
            tail = line[match.end():]
            method_match = re.match(r"\.([A-Za-zА-Яа-я_][\wА-Яа-я]*)", tail)
            if method_match:
                method = method_match.group(1)

            call = BSLCall(
                target_module=f"{prefix}.{name}",
                target_method=method,
                source_module=source_module,
                source_line=line_number,
            )
            key = (call.target_module, call.target_method, call.source_module, call.source_line)
            if key not in seen_calls:
                seen_calls.add(key)
                meta_calls.append(call)

            ref_key = (obj_type, name, source_module, line_number)
            if ref_key not in seen_refs and obj_type != "CommonModule":
                seen_refs.add(ref_key)
                query_refs.append(
                    BSLQueryRef(
                        obj_type=obj_type,
                        obj_name=name,
                        source_module=source_module,
                        source_line=line_number,
                    )
                )

        for string_match in STRING_PATTERN.finditer(line):
            query_text = string_match.group(1).replace('""', '"')
            for query_match in QUERY_REF_PATTERN.finditer(query_text):
                prefix, name = query_match.groups()
                obj_type = META_PREFIX_TO_TYPE.get(prefix, prefix)
                ref_key = (obj_type, name, source_module, line_number)
                if ref_key in seen_refs:
                    continue
                seen_refs.add(ref_key)
                query_refs.append(
                    BSLQueryRef(
                        obj_type=obj_type,
                        obj_name=name,
                        source_module=source_module,
                        source_line=line_number,
                    )
                )

    return meta_calls, query_refs


def _normalize_procedure_name(name: str) -> str:
    return (name or "").strip().lower()


def _build_procedure_index(objects: Dict[str, ObjectInfo]) -> Dict[Tuple[str, str], BSLProcedure]:
    index: Dict[Tuple[str, str], BSLProcedure] = {}
    for obj_info in objects.values():
        for procedure in obj_info.procedures:
            index[(procedure.module_path, _normalize_procedure_name(procedure.name))] = procedure
    return index


def _resolve_common_module_reference(handler: str) -> Tuple[str, str]:
    value = (handler or "").strip()
    if not value:
        return "", ""
    parts = [item for item in value.split(".") if item]
    if len(parts) >= 3 and parts[0] in {"CommonModules", "ОбщиеМодули"}:
        return parts[1], parts[2]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return "", parts[0]


def _find_module_path(objects: Dict[str, ObjectInfo], obj_type: str, name: str) -> str:
    object_key = f"{obj_type}.{name}"
    obj_info = objects.get(object_key)
    if not obj_info:
        return ""
    primary = obj_info.properties.get("primary_module_path", "")
    if primary:
        return primary
    if obj_info.procedures:
        return obj_info.procedures[0].module_path
    return ""


def _make_document_debug_points(obj_info: ObjectInfo) -> List[DebugPoint]:
    points: List[DebugPoint] = []
    by_name = {_normalize_procedure_name(proc.name): proc for proc in obj_info.procedures}
    module_path = obj_info.properties.get("primary_module_path", "")
    for context, aliases in DOCUMENT_DEBUG_ALIASES.items():
        matched = None
        for alias in aliases:
            matched = by_name.get(_normalize_procedure_name(alias))
            if matched:
                break
        if matched:
            points.append(
                DebugPoint(
                    procedure_name=matched.name,
                    module_path=matched.module_path,
                    line_number=matched.line_number,
                    context=context,
                    exists=True,
                    source_object=obj_info.name,
                    source_type=obj_info.obj_type,
                )
            )
        elif module_path:
            points.append(
                DebugPoint(
                    procedure_name=aliases[0],
                    module_path=module_path,
                    line_number=0,
                    context=context,
                    exists=False,
                    source_object=obj_info.name,
                    source_type=obj_info.obj_type,
                )
            )
    return points


def collect_debug_points(objects: Dict[str, ObjectInfo]) -> List[DebugPoint]:
    """Собрать реальные точки остановки по модулям и подпискам."""

    points: List[DebugPoint] = []
    procedure_index = _build_procedure_index(objects)

    for obj_info in objects.values():
        if obj_info.obj_type == "Document":
            points.extend(_make_document_debug_points(obj_info))

        if obj_info.obj_type == "EventSubscription" and obj_info.handler:
            module_name, procedure_name = _resolve_common_module_reference(obj_info.handler)
            module_path = _find_module_path(objects, "CommonModule", module_name)
            procedure = procedure_index.get((module_path, _normalize_procedure_name(procedure_name))) if module_path else None
            points.append(
                DebugPoint(
                    procedure_name=procedure_name or obj_info.handler,
                    module_path=module_path,
                    line_number=procedure.line_number if procedure else 0,
                    context=f"Подписка на событие: {obj_info.event or 'handler'}",
                    exists=procedure is not None,
                    source_object=obj_info.name,
                    source_type=obj_info.obj_type,
                )
            )

        if obj_info.obj_type == "ScheduledJob" and obj_info.properties.get("MethodName"):
            module_name, procedure_name = _resolve_common_module_reference(obj_info.properties["MethodName"])
            module_path = _find_module_path(objects, "CommonModule", module_name)
            procedure = procedure_index.get((module_path, _normalize_procedure_name(procedure_name))) if module_path else None
            points.append(
                DebugPoint(
                    procedure_name=procedure_name or obj_info.properties["MethodName"],
                    module_path=module_path,
                    line_number=procedure.line_number if procedure else 0,
                    context="Регламентное задание",
                    exists=procedure is not None,
                    source_object=obj_info.name,
                    source_type=obj_info.obj_type,
                )
            )

    unique = {}
    for point in points:
        key = (
            point.source_type,
            point.source_object,
            point.procedure_name,
            point.module_path,
            point.context,
        )
        unique[key] = point
    return list(unique.values())


def analyze_bsl(objects: Dict[str, ObjectInfo], config_path: str) -> List[DebugPoint]:
    """Заполнить BSL-информацию по всем объектам и вернуть точки отладки."""

    config_root = os.path.abspath(config_path)
    if os.path.isfile(config_root):
        config_root = os.path.dirname(config_root)

    for obj_info in objects.values():
        procedures: List[BSLProcedure] = []
        calls: List[BSLCall] = []
        query_refs: List[BSLQueryRef] = []

        for module_path in sorted(set(_iter_module_paths(obj_info, config_root))):
            absolute_module_path = os.path.join(config_root, module_path)
            text = _read_text(absolute_module_path)
            if not text:
                continue
            procedures.extend(_extract_procedures(text, module_path))
            calls.extend(_extract_calls(text, module_path))
            meta_calls, module_query_refs = _extract_meta_refs(text, module_path)
            calls.extend(meta_calls)
            query_refs.extend(module_query_refs)

        obj_info.procedures = procedures
        obj_info.bsl_calls = calls
        obj_info.bsl_query_refs = query_refs
        if procedures and not obj_info.properties.get("primary_module_path"):
            obj_info.properties["primary_module_path"] = procedures[0].module_path

    return collect_debug_points(objects)
