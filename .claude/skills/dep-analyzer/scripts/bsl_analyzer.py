"""Статический анализ BSL-кода: процедуры, вызовы, обращения к метаданным, запросы."""

import re
import os
from typing import List, Optional, Tuple

from models import (
    ObjectInfo, DependencyGraph, BSLProcedure, BSLCall,
    BSLQueryRef, DebugPoint, Edge, EdgeKind,
)
from xml_helpers import get_full_object_key
from scanner import get_bsl_module_paths

_RE_PROCEDURE = re.compile(
    r'^\s*(Процедура|Функция|Procedure|Function)\s+'
    r'(\w+)\s*\(',
    re.IGNORECASE | re.MULTILINE,
)

_RE_EXPORT = re.compile(r'\)\s*(Экспорт|Export)\s*$', re.IGNORECASE)

_RE_END_PROCEDURE = re.compile(
    r'^\s*(КонецПроцедуры|КонецФункции|EndProcedure|EndFunction)\s*$',
    re.IGNORECASE | re.MULTILINE,
)

_RE_MODULE_CALL = re.compile(
    r'(?<![.\w])'
    r'(\w+)\s*\.\s*(\w+)\s*\(',
)

_RE_MANAGER_ACCESS_PATTERNS = [
    (re.compile(r'(?:Справочники|Catalogs)\s*\.\s*(\w+)', re.IGNORECASE), "Catalog"),
    (re.compile(r'(?:Документы|Documents)\s*\.\s*(\w+)', re.IGNORECASE), "Document"),
    (re.compile(r'(?:РегистрыСведений|InformationRegisters)\s*\.\s*(\w+)', re.IGNORECASE), "InformationRegister"),
    (re.compile(r'(?:РегистрыНакопления|AccumulationRegisters)\s*\.\s*(\w+)', re.IGNORECASE), "AccumulationRegister"),
    (re.compile(r'(?:РегистрыБухгалтерии|AccountingRegisters)\s*\.\s*(\w+)', re.IGNORECASE), "AccountingRegister"),
    (re.compile(r'(?:РегистрыРасчёта|РегистрыРасчета|CalculationRegisters)\s*\.\s*(\w+)', re.IGNORECASE), "CalculationRegister"),
    (re.compile(r'(?:Перечисления|Enums)\s*\.\s*(\w+)', re.IGNORECASE), "Enum"),
    (re.compile(r'(?:ПланыВидовХарактеристик|ChartsOfCharacteristicTypes)\s*\.\s*(\w+)', re.IGNORECASE), "ChartOfCharacteristicTypes"),
    (re.compile(r'(?:ПланыСчетов|ChartsOfAccounts)\s*\.\s*(\w+)', re.IGNORECASE), "ChartOfAccounts"),
    (re.compile(r'(?:ПланыВидовРасчёта|ПланыВидовРасчета|ChartsOfCalculationTypes)\s*\.\s*(\w+)', re.IGNORECASE), "ChartOfCalculationTypes"),
    (re.compile(r'(?:БизнесПроцессы|BusinessProcesses)\s*\.\s*(\w+)', re.IGNORECASE), "BusinessProcess"),
    (re.compile(r'(?:Задачи|Tasks)\s*\.\s*(\w+)', re.IGNORECASE), "Task"),
    (re.compile(r'(?:ПланыОбмена|ExchangePlans)\s*\.\s*(\w+)', re.IGNORECASE), "ExchangePlan"),
    (re.compile(r'(?:Отчёты|Отчеты|Reports)\s*\.\s*(\w+)', re.IGNORECASE), "Report"),
    (re.compile(r'(?:Обработки|DataProcessors)\s*\.\s*(\w+)', re.IGNORECASE), "DataProcessor"),
    (re.compile(r'(?:Константы|Constants)\s*\.\s*(\w+)', re.IGNORECASE), "Constant"),
]

_RE_QUERY_OBJECT = re.compile(
    r'(?:Справочник|Catalog|Документ|Document|'
    r'РегистрСведений|InformationRegister|'
    r'РегистрНакопления|AccumulationRegister|'
    r'РегистрБухгалтерии|AccountingRegister|'
    r'РегистрРасчёта|РегистрРасчета|CalculationRegister|'
    r'Перечисление|Enum|'
    r'ПланВидовХарактеристик|ChartOfCharacteristicTypes|'
    r'ПланСчетов|ChartOfAccounts|'
    r'Константа|Constant)'
    r'\s*\.\s*(\w+)',
    re.IGNORECASE,
)

_QUERY_TYPE_MAP = {
    "справочник": "Catalog", "catalog": "Catalog",
    "документ": "Document", "document": "Document",
    "регистрсведений": "InformationRegister", "informationregister": "InformationRegister",
    "регистрнакопления": "AccumulationRegister", "accumulationregister": "AccumulationRegister",
    "регистрбухгалтерии": "AccountingRegister", "accountingregister": "AccountingRegister",
    "регистррасчёта": "CalculationRegister", "регистррасчета": "CalculationRegister",
    "calculationregister": "CalculationRegister",
    "перечисление": "Enum", "enum": "Enum",
    "планвидовхарактеристик": "ChartOfCharacteristicTypes",
    "chartofcharacteristictypes": "ChartOfCharacteristicTypes",
    "плансчетов": "ChartOfAccounts", "chartofaccounts": "ChartOfAccounts",
    "константа": "Constant", "constant": "Constant",
}

_RE_QUERY_BLOCK = re.compile(
    r'(?:'
    r'"[^"]*(?:ВЫБРАТЬ|SELECT|ИЗ|FROM|СОЕДИНЕНИЕ|JOIN|ГДЕ|WHERE)[^"]*"'
    r'|'
    r'"[^"]*"\s*\+\s*"[^"]*"'
    r')',
    re.IGNORECASE | re.DOTALL,
)

_RE_QUERY_INLINE = re.compile(
    r'(?:Справочник|Catalog|Документ|Document|'
    r'РегистрСведений|InformationRegister|'
    r'РегистрНакопления|AccumulationRegister|'
    r'РегистрБухгалтерии|AccountingRegister|'
    r'РегистрРасчёта|РегистрРасчета|CalculationRegister|'
    r'Перечисление|Enum|'
    r'ПланВидовХарактеристик|ChartOfCharacteristicTypes|'
    r'ПланСчетов|ChartOfAccounts|'
    r'Константа|Constant)'
    r'\s*\.\s*(\w+)',
    re.IGNORECASE,
)


def analyze_bsl(graph: DependencyGraph, config_path: str):
    """Analyze BSL code for all objects in the graph."""
    for key, obj in graph.objects.items():
        bsl_paths = get_bsl_module_paths(obj)
        for bsl_path in bsl_paths:
            _analyze_bsl_file(obj, bsl_path, graph, config_path)


def _analyze_bsl_file(obj: ObjectInfo, bsl_path: str, graph: DependencyGraph, config_path: str):
    """Analyze a single BSL file."""
    try:
        with open(bsl_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError):
        try:
            with open(bsl_path, "r", encoding="cp1251") as f:
                content = f.read()
        except Exception:
            return

    if not content.strip():
        return

    rel_path = os.path.relpath(bsl_path, config_path) if config_path else bsl_path
    lines = content.split("\n")

    _extract_procedures(obj, lines, rel_path)
    _extract_module_calls(obj, lines, rel_path, graph)
    _extract_metadata_access(obj, lines, rel_path, graph)
    _extract_query_refs(obj, content, lines, rel_path, graph)


def _extract_procedures(obj: ObjectInfo, lines: List[str], rel_path: str):
    """Extract procedure/function declarations."""
    for i, line in enumerate(lines, 1):
        m = _RE_PROCEDURE.match(line)
        if m:
            keyword = m.group(1).lower()
            name = m.group(2)
            is_function = keyword in ("функция", "function")
            is_export = bool(_RE_EXPORT.search(line))

            proc = BSLProcedure(
                name=name,
                line_number=i,
                is_function=is_function,
                is_export=is_export,
                module_path=rel_path,
            )
            obj.procedures.append(proc)


def _extract_module_calls(obj: ObjectInfo, lines: List[str], rel_path: str,
                          graph: DependencyGraph):
    """Extract calls to other modules (e.g., CommonModule.Method())."""
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue

        for m in _RE_MODULE_CALL.finditer(stripped):
            module_name = m.group(1)
            method_name = m.group(2)

            if _is_likely_common_module(module_name, graph):
                call = BSLCall(
                    target_module=module_name,
                    target_method=method_name,
                    source_module=rel_path,
                    source_line=i,
                )
                obj.bsl_calls.append(call)

                target_key = get_full_object_key("CommonModule", module_name)
                if target_key in graph.objects:
                    graph.add_edge(Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.BSL_CALL,
                        meta={"method": method_name, "line": str(i)},
                    ))


def _extract_metadata_access(obj: ObjectInfo, lines: List[str], rel_path: str,
                             graph: DependencyGraph):
    """Extract metadata access patterns (e.g., Справочники.Номенклатура)."""
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue

        for pattern, meta_type in _RE_MANAGER_ACCESS_PATTERNS:
            for m in pattern.finditer(stripped):
                target_name = m.group(1)
                target_key = get_full_object_key(meta_type, target_name)

                if source_key != target_key:
                    call = BSLCall(
                        target_module=f"{meta_type}.{target_name}",
                        target_method="",
                        source_module=rel_path,
                        source_line=i,
                    )
                    obj.bsl_calls.append(call)

                    if target_key in graph.objects:
                        graph.add_edge(Edge(
                            source=source_key,
                            target=target_key,
                            kind=EdgeKind.BSL_META_ACCESS,
                            meta={"line": str(i)},
                        ))


def _extract_query_refs(obj: ObjectInfo, content: str, lines: List[str],
                        rel_path: str, graph: DependencyGraph):
    """Extract metadata references from query text in BSL code."""
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue

        if '"' not in stripped:
            continue

        for m in _RE_QUERY_INLINE.finditer(stripped):
            full_match = m.group(0)
            obj_name = m.group(1)

            type_part = full_match.split(".")[0].strip().lower()
            meta_type = _QUERY_TYPE_MAP.get(type_part)
            if meta_type:
                qref = BSLQueryRef(
                    obj_type=meta_type,
                    obj_name=obj_name,
                    source_module=rel_path,
                    source_line=i,
                )
                obj.bsl_query_refs.append(qref)

                target_key = get_full_object_key(meta_type, obj_name)
                if target_key in graph.objects and source_key != target_key:
                    graph.add_edge(Edge(
                        source=source_key,
                        target=target_key,
                        kind=EdgeKind.BSL_QUERY_REF,
                        meta={"line": str(i)},
                    ))


def get_debug_points(obj: ObjectInfo, graph: DependencyGraph,
                     config_path: str) -> List[DebugPoint]:
    """Generate debug breakpoint suggestions for an object.

    Returns points where execution flow enters the object or its dependencies:
    - Posting procedures for documents
    - Event subscription handlers
    - Exported procedures in common modules
    - Form event handlers
    """
    points: List[DebugPoint] = []
    source_key = get_full_object_key(obj.obj_type, obj.name)

    for proc in obj.procedures:
        context = _determine_procedure_context(proc, obj)
        point = DebugPoint(
            procedure_name=proc.name,
            module_path=proc.module_path,
            line_number=proc.line_number,
            context=context,
            exists=True,
            source_object=obj.name,
            source_type=obj.obj_type,
        )
        points.append(point)

    if obj.obj_type == "Document":
        _add_posting_debug_points(obj, points, graph, config_path)

    sub_edges = graph.get_edges_to(source_key, EdgeKind.SUBSCRIPTION_TO_OBJECT)
    for edge in sub_edges:
        sub_obj = graph.objects.get(edge.source)
        if sub_obj and sub_obj.handler:
            parts = sub_obj.handler.rsplit(".", 1)
            handler_method = parts[-1] if parts else sub_obj.handler
            point = DebugPoint(
                procedure_name=handler_method,
                module_path=f"EventSubscription: {sub_obj.name}",
                context=f"Подписка «{sub_obj.synonym or sub_obj.name}» на событие {sub_obj.event}",
                source_object=sub_obj.name,
                source_type="EventSubscription",
            )
            points.append(point)

    return points


def _determine_procedure_context(proc: BSLProcedure, obj: ObjectInfo) -> str:
    """Determine the context/purpose of a procedure."""
    name_lower = proc.name.lower()

    posting_names = {"обработкапроведения", "posting", "handleposting"}
    if name_lower in posting_names:
        return "Проведение документа"

    fill_names = {"обработказаполнения", "filling", "handlefilling"}
    if name_lower in fill_names:
        return "Заполнение документа"

    before_write = {"передзаписью", "beforewrite"}
    if name_lower in before_write:
        return "Перед записью"

    on_write = {"призаписи", "onwrite"}
    if name_lower in on_write:
        return "При записи"

    before_delete = {"передудалением", "beforedelete"}
    if name_lower in before_delete:
        return "Перед удалением"

    if proc.is_export:
        return "Экспортная процедура"

    if "форм" in proc.module_path.lower() or "form" in proc.module_path.lower():
        return "Обработчик формы"

    return ""


def _add_posting_debug_points(obj: ObjectInfo, points: List[DebugPoint],
                              graph: DependencyGraph, config_path: str):
    """Add debug points for document posting-related procedures."""
    has_posting = any(
        p.name.lower() in ("обработкапроведения", "posting", "handleposting")
        for p in obj.procedures
    )

    if not has_posting and obj.movement_registers:
        point = DebugPoint(
            procedure_name="ОбработкаПроведения",
            module_path=f"{obj.obj_type}.{obj.name}/ObjectModule",
            context="Проведение документа (процедура не найдена в BSL)",
            exists=False,
            source_object=obj.name,
            source_type=obj.obj_type,
        )
        points.append(point)


def _is_likely_common_module(name: str, graph: DependencyGraph) -> bool:
    """Check if a name is likely a common module reference."""
    if graph.get_object("CommonModule", name):
        return True

    skip_prefixes = (
        "Строка", "String", "Число", "Number", "Дата", "Date",
        "Тип", "Type", "Массив", "Array", "Структура", "Structure",
        "Соответствие", "Map", "Объект", "Object", "Ссылка", "Ref",
        "НСтр", "NStr", "Формат", "Format",
    )
    if name in skip_prefixes or name.startswith(skip_prefixes):
        return False

    return len(name) > 3 and name[0].isupper()
