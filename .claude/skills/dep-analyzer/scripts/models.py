"""Shared data models for dep-analyzer skill."""

from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


class ObjectType(str, Enum):
    """Типы объектов метаданных 1С."""

    CATALOG = "Catalog"
    DOCUMENT = "Document"
    INFORMATION_REGISTER = "InformationRegister"
    ACCUMULATION_REGISTER = "AccumulationRegister"
    ACCOUNTING_REGISTER = "AccountingRegister"
    CALCULATION_REGISTER = "CalculationRegister"
    ENUM = "Enum"
    CHART_OF_CHARACTERISTIC_TYPES = "ChartOfCharacteristicTypes"
    CHART_OF_ACCOUNTS = "ChartOfAccounts"
    CHART_OF_CALCULATION_TYPES = "ChartOfCalculationTypes"
    BUSINESS_PROCESS = "BusinessProcess"
    TASK = "Task"
    EXCHANGE_PLAN = "ExchangePlan"
    REPORT = "Report"
    DATA_PROCESSOR = "DataProcessor"
    COMMON_MODULE = "CommonModule"
    EVENT_SUBSCRIPTION = "EventSubscription"
    ROLE = "Role"
    CONSTANT = "Constant"
    DOCUMENT_JOURNAL = "DocumentJournal"
    SCHEDULED_JOB = "ScheduledJob"
    DEFINED_TYPE = "DefinedType"
    HTTP_SERVICE = "HTTPService"
    WEB_SERVICE = "WebService"


class EdgeKind(str, Enum):
    """Типы рёбер графа зависимостей."""

    DOC_TO_REGISTER = "doc_to_register"
    DOC_TO_CATALOG = "doc_to_catalog"
    DOC_TO_DOCUMENT = "doc_to_document"
    CATALOG_TO_CATALOG = "catalog_to_catalog"
    CATALOG_TO_DOCUMENT = "catalog_to_document"
    REGISTER_TO_DOCUMENT = "register_to_document"
    REGISTER_TO_CATALOG = "register_to_catalog"
    REGISTER_TO_REGISTER = "register_to_register"
    SUBSCRIPTION_TO_OBJECT = "subscription_to_object"
    SUBSCRIPTION_TO_MODULE = "subscription_to_module"
    BSL_CALL = "bsl_call"
    BSL_META_ACCESS = "bsl_meta_access"
    BSL_QUERY_REF = "bsl_query_ref"
    BASED_ON = "based_on"
    OWNER = "owner"
    HIERARCHY = "hierarchy"


@dataclass
class TypeRef:
    """Ссылка на тип метаданных."""

    obj_type: str        # "Catalog", "Document", ...
    name: str            # "Номенклатура", "РеализацияТоваровУслуг", ...
    full_type: str       # "CatalogRef.Номенклатура"


@dataclass
class AttributeInfo:
    """Информация о реквизите/измерении/ресурсе."""

    name: str
    types: List[TypeRef] = field(default_factory=list)
    is_dimension: bool = False
    is_resource: bool = False
    tabular_section: str = ""


@dataclass
class TabularSectionInfo:
    """Информация о табличной части."""

    name: str
    attributes: List[AttributeInfo] = field(default_factory=list)


@dataclass
class ReferenceInfo:
    """Ссылка на другой объект метаданных."""

    source_attribute: str       # Имя реквизита-источника
    target_type: str            # "Catalog", "Document", ...
    target_name: str            # "Номенклатура"
    tabular_section: str = ""   # Если из ТЧ
    ref_kind: str = "attribute" # "attribute" | "hierarchy" | "owner" | "dimension" | "resource" | "based_on"


@dataclass
class BSLProcedure:
    """Процедура/функция из BSL-модуля."""

    name: str
    line_number: int
    is_function: bool = False
    is_export: bool = False
    module_path: str = ""       # Относительный путь к .bsl


@dataclass
class BSLCall:
    """Вызов из BSL-кода."""

    target_module: str          # "ОбщийМодуль" или "Справочники.Номенклатура"
    target_method: str = ""     # "НайтиПоКоду"
    source_module: str = ""     # Откуда вызов
    source_line: int = 0


@dataclass
class BSLQueryRef:
    """Ссылка на объект метаданных в тексте запроса."""

    obj_type: str               # "Catalog", "Document", "InformationRegister", ...
    obj_name: str               # "Номенклатура"
    source_module: str = ""
    source_line: int = 0


@dataclass
class RightInfo:
    """Одно право на объект."""

    right_name: str             # "Read", "Update", "View", ...
    value: bool = True
    has_rls: bool = False
    rls_condition: str = ""     # Текст условия RLS


@dataclass
class ObjectRights:
    """Права на один объект метаданных."""

    object_name: str            # "Catalog.Номенклатура" или "Catalog.Номенклатура.Attribute.ИНН"
    rights: List[RightInfo] = field(default_factory=list)


@dataclass
class RLSTemplate:
    """Шаблон ограничения доступа."""

    name: str
    condition: str


@dataclass
class RoleInfo:
    """Полная информация о роли."""

    name: str
    synonym: str = ""
    set_for_new_objects: bool = False
    set_for_attributes_by_default: bool = True
    independent_rights: bool = False
    object_rights: List[ObjectRights] = field(default_factory=list)
    rls_templates: List[RLSTemplate] = field(default_factory=list)


@dataclass
class DebugPoint:
    """Точка остановки для отладки."""

    procedure_name: str
    module_path: str            # Относительный путь к BSL-файлу
    line_number: int = 0        # 0 = не определён, >0 = конкретная строка
    context: str = ""           # "Проведение документа", "Подписка на событие", ...
    exists: bool = True         # Проверено наличие процедуры в BSL
    source_object: str = ""     # Имя исходного объекта метаданных
    source_type: str = ""       # Тип исходного объекта


@dataclass
class ObjectInfo:
    """Полная информация об объекте метаданных."""

    name: str
    obj_type: str               # "Catalog", "Document", ...
    path: str = ""              # Абсолютный путь к каталогу объекта

    # Свойства
    synonym: str = ""
    comment: str = ""
    properties: Dict[str, str] = field(default_factory=dict)

    # Структура
    attributes: List[AttributeInfo] = field(default_factory=list)
    tabular_sections: List[TabularSectionInfo] = field(default_factory=list)
    forms: List[str] = field(default_factory=list)
    templates: List[str] = field(default_factory=list)
    commands: List[str] = field(default_factory=list)

    # Связи (заполняются парсерами)
    references: List[ReferenceInfo] = field(default_factory=list)
    movement_registers: List[str] = field(default_factory=list)   # Только для документов
    based_on: List[str] = field(default_factory=list)             # Только для документов

    # BSL (заполняется bsl_analyzer)
    procedures: List[BSLProcedure] = field(default_factory=list)
    bsl_calls: List[BSLCall] = field(default_factory=list)
    bsl_query_refs: List[BSLQueryRef] = field(default_factory=list)

    # Подписки (только для EventSubscription)
    handler: str = ""
    source_types: List[str] = field(default_factory=list)
    event: str = ""

    # Роли (только для Role)
    role_info: Optional[RoleInfo] = None

    # Общие модули (только для CommonModule)
    is_global: bool = False
    is_server: bool = False
    is_client: bool = False
    is_external: bool = False


@dataclass
class Edge:
    """Ребро графа зависимостей."""

    source: str                 # "Document.РеализацияТоваровУслуг"
    target: str                 # "AccumulationRegister.ТоварыНаСкладах"
    kind: EdgeKind
    meta: Dict[str, str] = field(default_factory=dict)  # Доп. информация


class DependencyGraph:
    """Граф зависимостей конфигурации."""

    def __init__(self) -> None:
        self.objects: Dict[str, ObjectInfo] = {}        # "Catalog.Номенклатура" → ObjectInfo
        self.edges: List[Edge] = []
        self.roles: Dict[str, RoleInfo] = {}            # "ПолныеПрава" → RoleInfo
        self._edges_by_source: Dict[str, List[Edge]] = defaultdict(list)
        self._edges_by_target: Dict[str, List[Edge]] = defaultdict(list)
        self._edges_by_kind: Dict[EdgeKind, List[Edge]] = defaultdict(list)

    def add_object(self, obj_info: ObjectInfo) -> None:
        key = f"{obj_info.obj_type}.{obj_info.name}"
        self.objects[key] = obj_info

    def get_object(self, obj_type: str, name: str) -> Optional[ObjectInfo]:
        return self.objects.get(f"{obj_type}.{name}")

    def add_edge(self, edge: Edge) -> None:
        self.edges.append(edge)
        self._edges_by_source[edge.source].append(edge)
        self._edges_by_target[edge.target].append(edge)
        self._edges_by_kind[edge.kind].append(edge)

    def get_edges_from(self, source: str, kind: Optional[EdgeKind] = None) -> List[Edge]:
        edges = self._edges_by_source.get(source, [])
        if kind is not None:
            return [edge for edge in edges if edge.kind == kind]
        return edges

    def get_edges_to(self, target: str, kind: Optional[EdgeKind] = None) -> List[Edge]:
        edges = self._edges_by_target.get(target, [])
        if kind is not None:
            return [edge for edge in edges if edge.kind == kind]
        return edges

    def get_edges_by_kind(self, kind: EdgeKind) -> List[Edge]:
        return self._edges_by_kind.get(kind, [])

    def traverse(self, start: str, depth: int, direction: str = "outgoing") -> List[Tuple[Edge, int]]:
        """Обход графа от start до глубины depth.

        direction: 'outgoing' | 'incoming' | 'both'
        Returns: list of (edge, level)
        """
        if depth <= 0:
            return []

        visited: set = set()
        result: List[Tuple[Edge, int]] = []
        queue: deque[Tuple[str, int]] = deque([(start, 0)])

        while queue:
            current, level = queue.popleft()
            if level >= depth or current in visited:
                continue

            visited.add(current)
            edges: List[Edge] = []
            if direction in ("outgoing", "both"):
                edges.extend(self.get_edges_from(current))
            if direction in ("incoming", "both"):
                edges.extend(self.get_edges_to(current))

            for edge in edges:
                edge_level = level + 1
                if edge_level > depth:
                    continue
                result.append((edge, edge_level))
                next_node = edge.target if edge.source == current else edge.source
                if next_node not in visited:
                    queue.append((next_node, edge_level))

        return result

    def add_role(self, role_info: RoleInfo) -> None:
        self.roles[role_info.name] = role_info
