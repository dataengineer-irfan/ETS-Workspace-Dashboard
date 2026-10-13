from enum import Enum
from typing import Set, Optional, Dict, Any
from dataclasses import dataclass, field
from backend.app.ai.capability_registry import CapabilityEnum

class UserRole(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    HR_ANALYTICS = "HR_ANALYTICS"
    EXECUTIVE = "EXECUTIVE"
    ADMIN = "ADMIN"

ROLE_PERMISSIONS = {
    UserRole.EMPLOYEE: {
        "allowed_capabilities": {
            CapabilityEnum.HEADCOUNT,
            CapabilityEnum.ACTIVE_HEADCOUNT,
            CapabilityEnum.LEAVER_COUNT,
            CapabilityEnum.ATTRITION,
            CapabilityEnum.STATE_BREAKDOWN,
            CapabilityEnum.PROJECT_BREAKDOWN,
            CapabilityEnum.LOCATION_BREAKDOWN,
            CapabilityEnum.DEPARTMENT_BREAKDOWN,
            CapabilityEnum.AGE_BREAKDOWN,
            CapabilityEnum.GENDER_BREAKDOWN,
            CapabilityEnum.COMPENSATION_AVERAGE,
            CapabilityEnum.COMPENSATION_MIN,
            CapabilityEnum.COMPENSATION_MAX,
            CapabilityEnum.SALARY_TOTAL_COST,
            CapabilityEnum.RANKING,
            CapabilityEnum.TENURE,
            CapabilityEnum.EMPLOYEE_LOOKUP,
            CapabilityEnum.FOLLOW_UP_CONTEXT,
            CapabilityEnum.FILTER_COMPOSITION,
            CapabilityEnum.COMPARISON,
            CapabilityEnum.RAG_POLICY_QA,
            CapabilityEnum.RAG_GROUNDED_SYNTHESIS,
            CapabilityEnum.UNSUPPORTED_QUERY,
            CapabilityEnum.SKILL_DISTRIBUTION,
            CapabilityEnum.SKILLS_TOP_RANKING,
            CapabilityEnum.SKILLS_RAREST,
            CapabilityEnum.SKILLS_CONCENTRATION_RISK,
            CapabilityEnum.PROJECT_TECH_COVERAGE,
            CapabilityEnum.SKILL_HIRING_PRIORITIES,
            CapabilityEnum.SKILL_REDEPLOYMENT,
            CapabilityEnum.PROJECT_ATTRITION_EXPOSURE,
            CapabilityEnum.MANAGEMENT_SPAN_RISK,
            CapabilityEnum.TOP_WORKFORCE_RISKS,
            CapabilityEnum.STRATEGIC_INVESTMENTS,
            CapabilityEnum.UNSUPPORTED_COMMERCIAL_FINANCE
        },
        "allowed_tables": {"employees", "skills", "leaves", "finance_history"},
        "allowed_document_authorizations": {"ALL", "EMPLOYEE"}
    },
    UserRole.MANAGER: {
        "allowed_capabilities": set(CapabilityEnum),
        "allowed_tables": {"employees", "skills", "leaves", "finance_history"},
        "allowed_document_authorizations": {"ALL", "EMPLOYEE", "MANAGER"}
    },
    UserRole.HR_ANALYTICS: {
        "allowed_capabilities": set(CapabilityEnum),
        "allowed_tables": {"employees", "skills", "leaves", "finance_history"},
        "allowed_document_authorizations": {"ALL", "EMPLOYEE", "MANAGER", "HR"}
    },
    UserRole.EXECUTIVE: {
        "allowed_capabilities": set(CapabilityEnum),
        "allowed_tables": {"employees", "skills", "leaves", "finance_history"},
        "allowed_document_authorizations": {"ALL", "EMPLOYEE", "MANAGER", "HR", "EXECUTIVE"}
    },
    UserRole.ADMIN: {
        "allowed_capabilities": set(CapabilityEnum),
        "allowed_tables": {"employees", "skills", "leaves", "finance_history"},
        "allowed_document_authorizations": {"ALL", "EMPLOYEE", "MANAGER", "HR", "EXECUTIVE", "ADMIN"}
    }
}

@dataclass
class SecurityContext:
    user_id: str
    user_role: UserRole
    allowed_capabilities: Set[CapabilityEnum] = field(default_factory=set)
    allowed_tables: Set[str] = field(default_factory=set)
    allowed_document_authorizations: Set[str] = field(default_factory=set)
    department_scope: Optional[str] = None

    def __post_init__(self):
        perms = ROLE_PERMISSIONS.get(self.user_role, ROLE_PERMISSIONS[UserRole.EMPLOYEE])
        if not self.allowed_capabilities:
            self.allowed_capabilities = set(perms["allowed_capabilities"])
        if not self.allowed_tables:
            self.allowed_tables = set(perms["allowed_tables"])
        if not self.allowed_document_authorizations:
            self.allowed_document_authorizations = set(perms["allowed_document_authorizations"])

    def is_capability_authorized(self, capability: CapabilityEnum) -> bool:
        return capability in self.allowed_capabilities

    def is_document_authorized(self, doc_authorizations: Set[str]) -> bool:
        if "ALL" in doc_authorizations:
            return True
        return bool(self.allowed_document_authorizations.intersection(doc_authorizations))

    @classmethod
    def from_request(
        cls,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
        department: Optional[str] = None
    ) -> "SecurityContext":
        # Validate role string strictly
        role_str = (user_role or "EMPLOYEE").strip().upper()
        if role_str == "HR":
            role_str = "HR_ANALYTICS"
        elif role_str == "HR_ADMIN":
            role_str = "ADMIN"
        try:
            role = UserRole(role_str)
        except ValueError:
            role = UserRole.EMPLOYEE

        # ADMIN, EXECUTIVE, and HR_ANALYTICS have company-wide enterprise visibility (no department restriction)
        effective_department = department
        if role in (UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.HR_ANALYTICS):
            effective_department = None

        return cls(
            user_id=user_id or "anonymous_session",
            user_role=role,
            department_scope=effective_department
        )
