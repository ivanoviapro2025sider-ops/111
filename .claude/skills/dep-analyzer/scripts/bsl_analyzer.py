"""Статический анализ BSL-кода: процедуры, вызовы, обращения к метаданным, запросы."""
import re
import os
from typing import List, Optional, Tuple

from models import (
    ObjectInfo, DependencyGraph, BSLProcedure, BSLCall, BSLQueryRef,
    DebugPoint, Edge, EdgeKind,
)
from xml_helpers import get_full_object_key

_RE_PROCEDURE = re.compile(
    r"^\s*(?:Процедура|Procedure)\s+(\w+)\s*\(",
    re.IGNORECASE | re.MULTILINE,
)
_RE_FUNCTION = re.compile(
    r"^\s*(?:Функция|Function)\s+(\w+)\s*\(",
    re.IGNORECASE | re.MULTILINE,
)
_RE_EXPORT = re.compile(r"\)\s*(?:Экспорт|Export)\s*$", re.IGNORECASE)

_RE_COMMON_MODULE_CALL = re.compile(
    r"\b(\w+)\.(\w+)\s*\(",
    re.MULTILINE,
)

_RE_META_ACCESS_RU = re.compile(
    r"\b(Справочники|Документы|РегистрыСведений|РегистрыНакопления|"
    r"РегистрыБухгалтерии|РегистрыРасчёта|Перечисления|"
    r"ПланыВидовХарактеристик|ПланыСчетов|ПланыОбмена|"
    r"ПланыВидовРасчёта|БизнесПроцессы|Задачи|"
    r"Отчёты|Обработки|Константы)\s*\.\s*(\w+)",
    re.MULTILINE,
)

_RE_META_ACCESS_EN = re.compile(
    r"\b(Catalogs|Documents|InformationRegisters|AccumulationRegisters|"
    r"AccountingRegisters|CalculationRegisters|Enums|"
    r"ChartsOfCharacteristicTypes|ChartsOfAccounts|ExchangePlans|"
    r"ChartsOfCalculationTypes|BusinessProcesses|Tasks|"
    r"Reports|DataProcessors|Constants)\s*\.\s*(\w+)",
    re.MULTILINE,
)

_RU_COLLECTION_TO_TYPE = {
    "Справочники": "Catalog",
    "Документы": "Document",
    "РегистрыСведений": "InformationRegister",
    "РегистрыНакопления": "AccumulationRegister",
    "РегистрыБухгалтерии": "AccountingRegister",
    "РегистрыРасчёта": "CalculationRegister",
    "Перечисления": "Enum",
    "ПланыВидовХарактеристик": "ChartOfCharacteristicTypes",
    "ПланыСчетов": "ChartOfAccounts",
    "ПланыОбмена": "ExchangePlan",
    "ПланыВидовРасчёта": "ChartOfCalculationTypes",
    "БизнесПроцессы": "BusinessProcess",
    "Задачи": "Task",
    "Отчёты": "Report",
    "Обработки": "DataProcessor",
    "Константы": "Constant",
}

_EN_COLLECTION_TO_TYPE = {
    "Catalogs": "Catalog",
    "Documents": "Document",
    "InformationRegisters": "InformationRegister",
    "AccumulationRegisters": "AccumulationRegister",
    "AccountingRegisters": "AccountingRegister",
    "CalculationRegisters": "CalculationRegister",
    "Enums": "Enum",
    "ChartsOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ChartsOfAccounts": "ChartOfAccounts",
    "ExchangePlans": "ExchangePlan",
    "ChartsOfCalculationTypes": "ChartOfCalculationTypes",
    "BusinessProcesses": "BusinessProcess",
    "Tasks": "Task",
    "Reports": "Report",
    "DataProcessors": "DataProcessor",
    "Constants": "Constant",
}

_RE_QUERY_FROM = re.compile(
    r"(?:ИЗ|FROM)\s+(Справочник|Документ|РегистрСведений|РегистрНакопления|"
    r"РегистрБухгалтерии|РегистрРасчёта|ПланВидовХарактеристик|ПланСчетов|"
    r"ПланОбмена|ПланВидовРасчёта|Перечисление|"
    r"Catalog|Document|InformationRegister|AccumulationRegister|"
    r"AccountingRegister|CalculationRegister|ChartOfCharacteristicTypes|"
    r"ChartOfAccounts|ExchangePlan|ChartOfCalculationTypes|Enum)"
    r"\s*\.\s*(\w+)",
    re.IGNORECASE | re.MULTILINE,
)

_RE_QUERY_JOIN = re.compile(
    r"(?:СОЕДИНЕНИЕ|JOIN)\s+(?:ЛЕВОЕ\s+|ПРАВОЕ\s+|ПОЛНОЕ\s+|LEFT\s+|RIGHT\s+|FULL\s+|INNER\s+)?"
    r"(Справочник|Документ|РегистрСведений|РегистрНакопления|"
    r"РегистрБухгалтерии|РегистрРасчёта|"
    r"Catalog|Document|InformationRegister|AccumulationRegister|"
    r"AccountingRegister|CalculationRegister)"
    r"\s*\.\s*(\w+)",
    re.IGNORECASE | re.MULTILINE,
)

_QUERY_TYPE_TO_OBJ = {
    "Справочник": "Catalog", "Catalog": "Catalog",
    "Документ": "Document", "Document": "Document",
    "РегистрСведений": "InformationRegister", "InformationRegister": "InformationRegister",
    "РегистрНакопления": "AccumulationRegister", "AccumulationRegister": "AccumulationRegister",
    "РегистрБухгалтерии": "AccountingRegister", "AccountingRegister": "AccountingRegister",
    "РегистрРасчёта": "CalculationRegister", "CalculationRegister": "CalculationRegister",
    "ПланВидовХарактеристик": "ChartOfCharacteristicTypes", "ChartOfCharacteristicTypes": "ChartOfCharacteristicTypes",
    "ПланСчетов": "ChartOfAccounts", "ChartOfAccounts": "ChartOfAccounts",
    "ПланОбмена": "ExchangePlan", "ExchangePlan": "ExchangePlan",
    "ПланВидовРасчёта": "ChartOfCalculationTypes", "ChartOfCalculationTypes": "ChartOfCalculationTypes",
    "Перечисление": "Enum", "Enum": "Enum",
}

_BSL_KEYWORDS = {
    "Если", "Тогда", "ИначеЕсли", "Иначе", "КонецЕсли",
    "Для", "Каждого", "Из", "Цикл", "КонецЦикла",
    "Пока", "Попытка", "Исключение", "КонецПопытки",
    "Возврат", "Перем", "НЕ", "И", "ИЛИ", "Не",
    "If", "Then", "ElsIf", "Else", "EndIf",
    "For", "Each", "In", "Do", "EndDo",
    "While", "Try", "Except", "EndTry",
    "Return", "Var", "NOT", "AND", "OR",
    "Новый", "New", "Истина", "True", "Ложь", "False", "Неопределено", "Undefined",
    "Null", "Тип", "Type", "ТипЗнч", "TypeOf",
}


def analyze_bsl(graph: DependencyGraph, config_path: str):
    """Проанализировать BSL-код всех объектов в графе."""
    for key, obj in list(graph.objects.items()):
        bsl_files = _find_bsl_files(obj)
        for bsl_path in bsl_files:
            _analyze_bsl_file(bsl_path, obj, graph, config_path)


def _find_bsl_files(obj: ObjectInfo) -> List[str]:
    """Найти все BSL-файлы объекта."""
    results: List[str] = []
    if not obj.path or not os.path.isdir(obj.path):
        return results
    for dirpath, _, filenames in os.walk(obj.path):
        for fn in filenames:
            if fn.lower().endswith(".bsl"):
                results.append(os.path.join(dirpath, fn))
    return results


def _analyze_bsl_file(bsl_path: str, obj: ObjectInfo, graph: DependencyGraph,
                      config_path: str):
    """Анализ одного BSL-файла."""
    try:
        with open(bsl_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except Exception:
        try:
            with open(bsl_path, "r", encoding="cp1251") as f:
                content = f.read()
        except Exception:
            return

    rel_path = os.path.relpath(bsl_path, config_path)
    obj_key = get_full_object_key(obj.obj_type, obj.name)

    _extract_procedures(content, obj, rel_path)
    _extract_calls(content, obj, graph, obj_key, rel_path)
    _extract_meta_access(content, obj, graph, obj_key, rel_path)
    _extract_query_refs(content, obj, graph, obj_key, rel_path)


def _extract_procedures(content: str, obj: ObjectInfo, rel_path: str):
    """Извлечь процедуры и функции."""
    lines = content.split("\n")
    for i, line in enumerate(lines, 1):
        m = _RE_PROCEDURE.match(line)
        if m:
            name = m.group(1)
            is_export = bool(_RE_EXPORT.search(line))
            obj.procedures.append(BSLProcedure(
                name=name,
                line_number=i,
                is_function=False,
                is_export=is_export,
                module_path=rel_path,
            ))
            continue

        m = _RE_FUNCTION.match(line)
        if m:
            name = m.group(1)
            is_export = bool(_RE_EXPORT.search(line))
            obj.procedures.append(BSLProcedure(
                name=name,
                line_number=i,
                is_function=True,
                is_export=is_export,
                module_path=rel_path,
            ))


def _extract_calls(content: str, obj: ObjectInfo, graph: DependencyGraph,
                   obj_key: str, rel_path: str):
    """Извлечь вызовы общих модулей."""
    lines = content.split("\n")
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue

        for m in _RE_COMMON_MODULE_CALL.finditer(line):
            module = m.group(1)
            method = m.group(2)

            if module in _BSL_KEYWORDS or module in _RU_COLLECTION_TO_TYPE or module in _EN_COLLECTION_TO_TYPE:
                continue

            if module[0].islower() and not module[0].isascii():
                pass
            elif module[0].islower():
                continue

            call = BSLCall(
                target_module=module,
                target_method=method,
                source_module=rel_path,
                source_line=i,
            )
            obj.bsl_calls.append(call)

            target_key = get_full_object_key("CommonModule", module)
            if target_key in graph.objects:
                graph.add_edge(Edge(
                    source=obj_key,
                    target=target_key,
                    kind=EdgeKind.BSL_CALL,
                    meta={"method": method, "line": str(i), "module": rel_path},
                ))


def _extract_meta_access(content: str, obj: ObjectInfo, graph: DependencyGraph,
                         obj_key: str, rel_path: str):
    """Извлечь обращения к коллекциям метаданных (Справочники.Номенклатура и т.д.)."""
    lines = content.split("\n")
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("//"):
            continue

        for m in _RE_META_ACCESS_RU.finditer(line):
            collection = m.group(1)
            name = m.group(2)
            obj_type = _RU_COLLECTION_TO_TYPE.get(collection)
            if obj_type:
                target_key = get_full_object_key(obj_type, name)
                graph.add_edge(Edge(
                    source=obj_key,
                    target=target_key,
                    kind=EdgeKind.BSL_META_ACCESS,
                    meta={"line": str(i), "module": rel_path},
                ))

        for m in _RE_META_ACCESS_EN.finditer(line):
            collection = m.group(1)
            name = m.group(2)
            obj_type = _EN_COLLECTION_TO_TYPE.get(collection)
            if obj_type:
                target_key = get_full_object_key(obj_type, name)
                graph.add_edge(Edge(
                    source=obj_key,
                    target=target_key,
                    kind=EdgeKind.BSL_META_ACCESS,
                    meta={"line": str(i), "module": rel_path},
                ))


def _extract_query_refs(content: str, obj: ObjectInfo, graph: DependencyGraph,
                        obj_key: str, rel_path: str):
    """Извлечь ссылки на объекты из текстов запросов в BSL."""
    lines = content.split("\n")
    in_query = False
    query_lines: List[Tuple[int, str]] = []

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        if '"""' in stripped or "ВЫБРАТЬ" in stripped.upper() or "SELECT" in stripped.upper():
            in_query = True

        if in_query:
            query_lines.append((i, line))

        has_from = any(kw in stripped.upper() for kw in ("FROM", "ИЗ", "JOIN", "СОЕДИНЕНИЕ"))
        if has_from or (in_query and stripped.endswith('";')):
            pass

        if in_query and (stripped.endswith('";') or stripped.endswith('")')):
            in_query = False

    full_text = content

    for m in _RE_QUERY_FROM.finditer(full_text):
        query_type = m.group(1)
        query_name = m.group(2)
        obj_type = _QUERY_TYPE_TO_OBJ.get(query_type)
        if obj_type:
            line_num = content[:m.start()].count("\n") + 1
            obj.bsl_query_refs.append(BSLQueryRef(
                obj_type=obj_type,
                obj_name=query_name,
                source_module=rel_path,
                source_line=line_num,
            ))
            target_key = get_full_object_key(obj_type, query_name)
            graph.add_edge(Edge(
                source=obj_key,
                target=target_key,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={"line": str(line_num), "module": rel_path, "context": "FROM"},
            ))

    for m in _RE_QUERY_JOIN.finditer(full_text):
        query_type = m.group(1)
        query_name = m.group(2)
        obj_type = _QUERY_TYPE_TO_OBJ.get(query_type)
        if obj_type:
            line_num = content[:m.start()].count("\n") + 1
            obj.bsl_query_refs.append(BSLQueryRef(
                obj_type=obj_type,
                obj_name=query_name,
                source_module=rel_path,
                source_line=line_num,
            ))
            target_key = get_full_object_key(obj_type, query_name)
            graph.add_edge(Edge(
                source=obj_key,
                target=target_key,
                kind=EdgeKind.BSL_QUERY_REF,
                meta={"line": str(line_num), "module": rel_path, "context": "JOIN"},
            ))


def get_debug_points(graph: DependencyGraph, object_key: str,
                     config_path: str) -> List[DebugPoint]:
    """Получить точки отладки для объекта: процедуры, обработчики подписок и т.д."""
    points: List[DebugPoint] = []
    obj = graph.objects.get(object_key)
    if not obj:
        return points

    for proc in obj.procedures:
        points.append(DebugPoint(
            procedure_name=proc.name,
            module_path=proc.module_path,
            line_number=proc.line_number,
            context="Экспортная процедура" if proc.is_export else "Локальная процедура",
            exists=True,
            source_object=obj.name,
            source_type=obj.obj_type,
        ))

    if obj.obj_type == "Document":
        _add_document_debug_points(obj, graph, points)

    _add_subscription_debug_points(obj, graph, points, config_path)

    return points


def _add_document_debug_points(obj: ObjectInfo, graph: DependencyGraph,
                               points: List[DebugPoint]):
    """Добавить точки отладки для документа: проведение."""
    posting_proc = None
    for proc in obj.procedures:
        name_lower = proc.name.lower()
        if name_lower in ("обработкапроведения", "posting"):
            posting_proc = proc
            break
    if posting_proc:
        points.append(DebugPoint(
            procedure_name=posting_proc.name,
            module_path=posting_proc.module_path,
            line_number=posting_proc.line_number,
            context="Проведение документа",
            exists=True,
            source_object=obj.name,
            source_type=obj.obj_type,
        ))


def _add_subscription_debug_points(obj: ObjectInfo, graph: DependencyGraph,
                                    points: List[DebugPoint], config_path: str):
    """Добавить точки отладки из подписок, ссылающихся на данный объект."""
    obj_key = get_full_object_key(obj.obj_type, obj.name)
    for edge in graph.get_edges_to(obj_key, EdgeKind.SUBSCRIPTION_TO_OBJECT):
        sub = graph.objects.get(edge.source)
        if not sub or not sub.handler:
            continue
        handler_parts = sub.handler.split(".")
        if len(handler_parts) >= 2:
            module_name = handler_parts[0]
            method_name = handler_parts[1] if len(handler_parts) > 1 else ""
            module_obj = graph.get_object("CommonModule", module_name)
            line = 0
            module_path = ""
            if module_obj:
                for proc in module_obj.procedures:
                    if proc.name == method_name:
                        line = proc.line_number
                        module_path = proc.module_path
                        break
            points.append(DebugPoint(
                procedure_name=sub.handler,
                module_path=module_path,
                line_number=line,
                context=f"Подписка: {sub.name} ({sub.event})",
                exists=line > 0,
                source_object=sub.name,
                source_type="EventSubscription",
            ))
