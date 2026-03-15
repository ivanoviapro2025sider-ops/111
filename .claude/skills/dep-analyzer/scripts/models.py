"""Shared data models for the dep-analyzer skill."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


class ObjectType(str, Enum):
    """Supported 1C metadata object types."""

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
    """Kinds of dependency graph edges."""

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
    """Reference to a metadata type."""

    obj_type: str
    name: str
    full_type: str


@dataclass
class AttributeInfo:
    """Metadata attribute, dimension, or resource."""

    name: str
    types: List[TypeRef] = field(default_factory=list)
    is_dimension: bool = False
    is_resource: bool = False
    tabular_section: str = ""


@dataclass
class TabularSectionInfo:
    """Tabular section with nested attributes."""

    name: str
    attributes: List[AttributeInfo] = field(default_factory=list)


@dataclass
class ReferenceInfo:
    """Reference from one metadata object to another."""

    source_attribute: str
    target_type: str
    target_name: str
    tabular_section: str = ""
    ref_kind: str = "attribute"


@dataclass
class BSLProcedure:
    """Procedure or function found in BSL source."""

    name: str
    line_number: int
    is_function: bool = False
    is_export: bool = False
    module_path: str = ""


@dataclass
class BSLCall:
    """Call from BSL to another module or metadata object."""

    target_module: str
    target_method: str = ""
    source_module: str = ""
    source_line: int = 0


@dataclass
class BSLQueryRef:
    """Metadata reference found in a query string."""

    obj_type: str
    obj_name: str
    source_module: str = ""
    source_line: int = 0


@dataclass
class RightInfo:
    """Single right for a metadata object."""

    right_name: str
    value: bool = True
    has_rls: bool = False
    rls_condition: str = ""


@dataclass
class ObjectRights:
    """Rights assigned to a specific object."""

    object_name: str
    rights: List[RightInfo] = field(default_factory=list)


@dataclass
class RLSTemplate:
    """RLS template description."""

    name: str
    condition: str


@dataclass
class RoleInfo:
    """Aggregated role information."""

    name: str
    synonym: str = ""
    set_for_new_objects: bool = False
    set_for_attributes_by_default: bool = True
    independent_rights: bool = False
    object_rights: List[ObjectRights] = field(default_factory=list)
    rls_templates: List[RLSTemplate] = field(default_factory=list)


@dataclass
class DebugPoint:
    """Resolved or potential debug breakpoint."""

    procedure_name: str
    module_path: str
    line_number: int = 0
    context: str = ""
    exists: bool = True
    source_object: str = ""
    source_type: str = ""


@dataclass
class ObjectInfo:
    """Full metadata object description."""

    name: str
    obj_type: str
    path: str = ""
    synonym: str = ""
    comment: str = ""
    properties: Dict[str, str] = field(default_factory=dict)
    attributes: List[AttributeInfo] = field(default_factory=list)
    tabular_sections: List[TabularSectionInfo] = field(default_factory=list)
    forms: List[str] = field(default_factory=list)
    templates: List[str] = field(default_factory=list)
    commands: List[str] = field(default_factory=list)
    references: List[ReferenceInfo] = field(default_factory=list)
    movement_registers: List[str] = field(default_factory=list)
    based_on: List[str] = field(default_factory=list)
    procedures: List[BSLProcedure] = field(default_factory=list)
    bsl_calls: List[BSLCall] = field(default_factory=list)
    bsl_meta_refs: List[BSLQueryRef] = field(default_factory=list)
    bsl_query_refs: List[BSLQueryRef] = field(default_factory=list)
    handler: str = ""
    source_types: List[str] = field(default_factory=list)
    event: str = ""
    role_info: Optional[RoleInfo] = None
    is_global: bool = False
    is_server: bool = False
    is_client: bool = False
    is_external: bool = False


@dataclass
class Edge:
    """Dependency graph edge."""

    source: str
    target: str
    kind: EdgeKind
    meta: Dict[str, str] = field(default_factory=dict)


class DependencyGraph:
    """Dependency graph built from configuration metadata."""

    def __init__(self) -> None:
        self.objects: Dict[str, ObjectInfo] = {}
        self.edges: List[Edge] = []
        self.roles: Dict[str, RoleInfo] = {}
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
        return list(edges)

    def get_edges_to(self, target: str, kind: Optional[EdgeKind] = None) -> List[Edge]:
        edges = self._edges_by_target.get(target, [])
        if kind is not None:
            return [edge for edge in edges if edge.kind == kind]
        return list(edges)

    def get_edges_by_kind(self, kind: EdgeKind) -> List[Edge]:
        return list(self._edges_by_kind.get(kind, []))

    def traverse(self, start: str, depth: int, direction: str = "outgoing") -> List[Tuple[Edge, int]]:
        """Traverse graph from a starting node.

        Args:
            start: Starting object key, for example ``Document.SalesInvoice``.
            depth: Maximum traversal depth. ``0`` means no edges are returned.
            direction: ``outgoing``, ``incoming`` or ``both``.

        Returns:
            A list of ``(edge, level)`` pairs where ``level`` starts from 1.
        """

        if depth <= 0 or start not in self.objects:
            return []

        if direction not in {"outgoing", "incoming", "both"}:
            raise ValueError("direction must be 'outgoing', 'incoming' or 'both'")

        queue = deque([(start, 0)])
        visited_nodes = {start}
        seen_edges = set()
        result: List[Tuple[Edge, int]] = []

        while queue:
            current, level = queue.popleft()
            if level >= depth:
                continue

            current_edges: List[Tuple[Edge, str]] = []
            if direction in {"outgoing", "both"}:
                current_edges.extend((edge, edge.target) for edge in self.get_edges_from(current))
            if direction in {"incoming", "both"}:
                current_edges.extend((edge, edge.source) for edge in self.get_edges_to(current))

            for edge, next_node in current_edges:
                edge_key = (edge.source, edge.target, edge.kind.value, tuple(sorted(edge.meta.items())))
                if edge_key not in seen_edges:
                    result.append((edge, level + 1))
                    seen_edges.add(edge_key)
                if next_node not in visited_nodes:
                    visited_nodes.add(next_node)
                    queue.append((next_node, level + 1))

        return result

    def add_role(self, role_info: RoleInfo) -> None:
        self.roles[role_info.name] = role_info
