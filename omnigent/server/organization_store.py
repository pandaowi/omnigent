"""Organization and Host Assignment management store."""

from __future__ import annotations

import json
import logging
import os
import secrets
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, delete, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from omnigent.db.db_models import OmnigentBase, Uuid16, current_workspace_id
from omnigent.db.utils import get_or_create_engine, now_epoch

_logger = logging.getLogger(__name__)


class SqlHostPermission(OmnigentBase):
    """Junction table mapping (workspace_id, host_id, user_id) to host permissions."""

    __tablename__ = "host_permissions"

    workspace_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        default=current_workspace_id,
    )
    host_id: Mapped[str] = mapped_column(Uuid16(), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    assigned_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now_epoch)
    allowed_models: Mapped[str | None] = mapped_column(Text, nullable=True)
    harness: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    allowed_harnesses: Mapped[str | None] = mapped_column(Text, nullable=True)


class SqlOrganization(OmnigentBase):
    """Organization / team definition."""

    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[int] = mapped_column(Integer, default=now_epoch)


class SqlOrganizationMember(OmnigentBase):
    """Members of an organization."""

    __tablename__ = "organization_members"

    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    role: Mapped[str] = mapped_column(String(32), default="member")
    created_at: Mapped[int] = mapped_column(Integer, default=now_epoch)


class SqlOrganizationHostAssignment(OmnigentBase):
    """Host assignments to organizations."""

    __tablename__ = "organization_host_assignments"

    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    workspace_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        default=current_workspace_id,
    )
    host_id: Mapped[str] = mapped_column(Uuid16(), primary_key=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now_epoch)
    allowed_models: Mapped[str | None] = mapped_column(Text, nullable=True)
    harness: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    allowed_harnesses: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrganizationStore:
    """Store for managing organizations and host permissions."""

    def __init__(self, db_uri: str | None = None) -> None:
        uri = db_uri or os.environ.get("DATABASE_URL") or os.environ.get("OMNIGENT_STORAGE_LOCATION", "")
        self._engine = get_or_create_engine(uri)

    def _session(self) -> Session:
        return Session(self._engine)

    # ── Host Assignments ──────────────────────────────────────────

    def assign_user_to_host(
        self,
        host_id: str,
        user_id: str,
        assigned_by: str | None = None,
        level: int = 1,
        allowed_models: list[str] | None = None,
    ) -> dict[str, Any]:
        ws_id = current_workspace_id()
        models_str = json.dumps(allowed_models) if allowed_models is not None else None
        with self._session() as s:
            row = s.get(SqlHostPermission, (ws_id, host_id, user_id))
            if row is None:
                row = SqlHostPermission(
                    workspace_id=ws_id,
                    host_id=host_id,
                    user_id=user_id,
                    level=level,
                    assigned_by=assigned_by,
                    created_at=now_epoch(),
                    allowed_models=models_str,
                )
                s.add(row)
            else:
                row.level = level
                row.assigned_by = assigned_by
                row.allowed_models = models_str
            s.commit()
            return {
                "host_id": host_id,
                "user_id": user_id,
                "level": row.level,
                "assigned_by": row.assigned_by,
                "created_at": row.created_at,
                "allowed_models": allowed_models,
            }

    def unassign_user_from_host(self, host_id: str, user_id: str) -> bool:
        ws_id = current_workspace_id()
        with self._session() as s:
            row = s.get(SqlHostPermission, (ws_id, host_id, user_id))
            if row is not None:
                s.delete(row)
                s.commit()
                return True
            return False

    def assign_org_to_host(
        self,
        host_id: str,
        organization_id: str,
        allowed_models: list[str] | None = None,
    ) -> dict[str, Any]:
        ws_id = current_workspace_id()
        models_str = json.dumps(allowed_models) if allowed_models is not None else None
        with self._session() as s:
            row = s.get(SqlOrganizationHostAssignment, (organization_id, ws_id, host_id))
            if row is None:
                row = SqlOrganizationHostAssignment(
                    organization_id=organization_id,
                    workspace_id=ws_id,
                    host_id=host_id,
                    created_at=now_epoch(),
                    allowed_models=models_str,
                )
                s.add(row)
            else:
                row.allowed_models = models_str
            s.commit()
            return {
                "organization_id": organization_id,
                "host_id": host_id,
                "created_at": row.created_at,
                "allowed_models": allowed_models,
            }

    def unassign_org_from_host(self, host_id: str, organization_id: str) -> bool:
        ws_id = current_workspace_id()
        with self._session() as s:
            row = s.get(SqlOrganizationHostAssignment, (organization_id, ws_id, host_id))
            if row is not None:
                s.delete(row)
                s.commit()
                return True
            return False

    def list_host_assignments(self, host_id: str) -> dict[str, Any]:
        ws_id = current_workspace_id()
        with self._session() as s:
            user_rows = s.execute(
                select(SqlHostPermission).where(
                    SqlHostPermission.workspace_id == ws_id,
                    SqlHostPermission.host_id == host_id,
                )
            ).scalars().all()
            org_rows = s.execute(
                select(SqlOrganizationHostAssignment, SqlOrganization.name)
                .join(SqlOrganization, SqlOrganization.id == SqlOrganizationHostAssignment.organization_id)
                .where(
                    SqlOrganizationHostAssignment.workspace_id == ws_id,
                    SqlOrganizationHostAssignment.host_id == host_id,
                )
            ).all()

            users = []
            for r in user_rows:
                models = None
                if r.allowed_models:
                    try:
                        models = json.loads(r.allowed_models)
                    except Exception:
                        pass
                users.append({
                    "user_id": r.user_id,
                    "level": r.level,
                    "assigned_by": r.assigned_by,
                    "created_at": r.created_at,
                    "allowed_models": models,
                })

            orgs = []
            for r in org_rows:
                models = None
                if r[0].allowed_models:
                    try:
                        models = json.loads(r[0].allowed_models)
                    except Exception:
                        pass
                orgs.append({
                    "organization_id": r[0].organization_id,
                    "name": r[1],
                    "created_at": r[0].created_at,
                    "allowed_models": models,
                })

            return {"users": users, "organizations": orgs}

    def get_user_authorized_host_ids(self, user_id: str) -> set[str]:
        ws_id = current_workspace_id()
        with self._session() as s:
            direct_hosts = s.execute(
                select(SqlHostPermission.host_id).where(
                    SqlHostPermission.workspace_id == ws_id,
                    SqlHostPermission.user_id == user_id,
                )
            ).scalars().all()

            org_hosts = s.execute(
                select(SqlOrganizationHostAssignment.host_id)
                .join(
                    SqlOrganizationMember,
                    SqlOrganizationMember.organization_id == SqlOrganizationHostAssignment.organization_id,
                )
                .where(
                    SqlOrganizationHostAssignment.workspace_id == ws_id,
                    SqlOrganizationMember.user_id == user_id,
                )
            ).scalars().all()

            return set(direct_hosts) | set(org_hosts)

    def is_user_authorized_for_host(
        self,
        user_id: str | None,
        host_id: str,
        host_owner: str | None = None,
        is_admin: bool = False,
    ) -> bool:
        if not user_id:
            return True
        if is_admin or user_id == host_owner:
            return True
        if os.environ.get("OMNIGENT_SHARED_HOST", "").lower() in ("1", "true", "yes", "on"):
            return True
        authorized = self.get_user_authorized_host_ids(user_id)
        return host_id in authorized

    def get_user_allowed_models(self, user_id: str, host_id: str) -> list[str] | None:
        """Return allowed model list for a user on host_id, or None if all models allowed."""
        ws_id = current_workspace_id()
        with self._session() as s:
            # 1. Check direct user permission
            user_perm = s.get(SqlHostPermission, (ws_id, host_id, user_id))
            if user_perm is not None and user_perm.allowed_models is not None:
                try:
                    return json.loads(user_perm.allowed_models)
                except Exception:
                    return None

            # If user has explicit permission with allowed_models is None, they have access to all models
            if user_perm is not None and user_perm.allowed_models is None:
                return None

            # 2. Check team/organization permissions
            user_orgs = s.execute(
                select(SqlOrganizationMember.organization_id).where(
                    SqlOrganizationMember.user_id == user_id
                )
            ).scalars().all()

            if not user_orgs:
                return None

            org_assignments = s.execute(
                select(SqlOrganizationHostAssignment).where(
                    SqlOrganizationHostAssignment.workspace_id == ws_id,
                    SqlOrganizationHostAssignment.host_id == host_id,
                    SqlOrganizationHostAssignment.organization_id.in_(user_orgs),
                )
            ).scalars().all()

            if not org_assignments:
                return None

            allowed_union: set[str] = set()
            has_restriction = False
            for oa in org_assignments:
                if oa.allowed_models is None:
                    # One team has full model access
                    return None
                try:
                    models = json.loads(oa.allowed_models)
                    if isinstance(models, list):
                        allowed_union.update(models)
                        has_restriction = True
                except Exception:
                    pass

            return list(allowed_union) if has_restriction else None

    def get_all_user_host_assignments(self) -> dict[str, dict[str, Any]]:
        """Return mapping of user_id -> { host_id, level, harness, default_model, allowed_harnesses, allowed_models }."""
        ws_id = current_workspace_id()
        with self._session() as s:
            rows = s.execute(
                select(SqlHostPermission).where(SqlHostPermission.workspace_id == ws_id)
            ).scalars().all()
            mapping: dict[str, dict[str, Any]] = {}
            for r in rows:
                models = None
                if r.allowed_models:
                    try:
                        models = json.loads(r.allowed_models)
                    except Exception:
                        pass
                allowed_harnesses = None
                if r.allowed_harnesses:
                    try:
                        allowed_harnesses = json.loads(r.allowed_harnesses)
                    except Exception:
                        pass
                harness = r.harness
                if not harness and models:
                    if any("gemini" in m.lower() for m in models):
                        harness = "antigravity-native"
                    elif any("gpt" in m.lower() for m in models):
                        harness = "codex-native"
                if not allowed_harnesses and harness:
                    allowed_harnesses = [harness]
                mapping[r.user_id] = {
                    "host_id": r.host_id,
                    "level": r.level,
                    "harness": harness or "antigravity-native",
                    "default_model": r.default_model or (models[0] if models else "gemini-3.8-flash-high"),
                    "allowed_harnesses": allowed_harnesses or [harness or "antigravity-native"],
                    "allowed_models": models,
                }
            return mapping

    def get_user_execution_assignment(self, user_id: str) -> dict[str, Any] | None:
        """Return the execution assignment for a specific user."""
        ws_id = current_workspace_id()
        with self._session() as s:
            row = s.execute(
                select(SqlHostPermission).where(
                    SqlHostPermission.workspace_id == ws_id,
                    SqlHostPermission.user_id == user_id,
                )
            ).scalars().first()
            if row is None:
                return None
            models = None
            if row.allowed_models:
                try:
                    models = json.loads(row.allowed_models)
                except Exception:
                    pass
            allowed_harnesses = None
            if row.allowed_harnesses:
                try:
                    allowed_harnesses = json.loads(row.allowed_harnesses)
                except Exception:
                    pass
            harness = row.harness
            if not harness and models:
                if any("gemini" in m.lower() for m in models):
                    harness = "antigravity-native"
                elif any("gpt" in m.lower() for m in models):
                    harness = "codex-native"
            if not allowed_harnesses and harness:
                allowed_harnesses = [harness]
            return {
                "user_id": row.user_id,
                "host_id": row.host_id,
                "level": row.level,
                "harness": harness or (allowed_harnesses[0] if allowed_harnesses else "antigravity-native"),
                "default_model": row.default_model or (models[0] if models else "gemini-3.8-flash-high"),
                "allowed_harnesses": allowed_harnesses or [harness or "antigravity-native"],
                "allowed_models": models,
            }

    def set_user_host_execution(
        self,
        user_id: str,
        host_id: str | None,
        allowed_models: list[str] | None = None,
        assigned_by: str | None = None,
        level: int = 1,
        harness: str | None = None,
        default_model: str | None = None,
        allowed_harnesses: list[str] | None = None,
    ) -> dict[str, Any]:
        """Update host assignment, harness, default model, and allowed models for a user."""
        ws_id = current_workspace_id()
        with self._session() as s:
            if host_id is None:
                s.execute(
                    delete(SqlHostPermission).where(
                        SqlHostPermission.workspace_id == ws_id,
                        SqlHostPermission.user_id == user_id,
                    )
                )
                s.commit()
                return {"user_id": user_id, "host_id": None, "allowed_models": None, "harness": None, "default_model": None, "allowed_harnesses": None}

            # If harness not provided, infer from allowed_harnesses or allowed_models
            if not harness and allowed_harnesses:
                harness = allowed_harnesses[0]
            elif not harness and allowed_models:
                if any("gemini" in m.lower() for m in allowed_models):
                    harness = "antigravity-native"
                elif any("gpt" in m.lower() for m in allowed_models):
                    harness = "codex-native"

            if not allowed_harnesses and harness:
                allowed_harnesses = [harness]

            models_str = json.dumps(allowed_models) if allowed_models is not None else None
            harnesses_str = json.dumps(allowed_harnesses) if allowed_harnesses is not None else None

            # remove other host assignments for this user
            s.execute(
                delete(SqlHostPermission).where(
                    SqlHostPermission.workspace_id == ws_id,
                    SqlHostPermission.user_id == user_id,
                    SqlHostPermission.host_id != host_id,
                )
            )
            row = s.get(SqlHostPermission, (ws_id, host_id, user_id))
            if row is None:
                row = SqlHostPermission(
                    workspace_id=ws_id,
                    host_id=host_id,
                    user_id=user_id,
                    level=level,
                    assigned_by=assigned_by,
                    created_at=now_epoch(),
                    allowed_models=models_str,
                    harness=harness,
                    default_model=default_model,
                    allowed_harnesses=harnesses_str,
                )
                s.add(row)
            else:
                row.level = level
                row.assigned_by = assigned_by
                row.allowed_models = models_str
                if harness is not None:
                    row.harness = harness
                if default_model is not None:
                    row.default_model = default_model
                if harnesses_str is not None:
                    row.allowed_harnesses = harnesses_str
            s.commit()
            return {
                "user_id": user_id,
                "host_id": host_id,
                "level": level,
                "harness": row.harness,
                "default_model": row.default_model,
                "allowed_harnesses": allowed_harnesses,
                "allowed_models": allowed_models,
            }

    # ── Organizations ──────────────────────────────────────────────

    def create_organization(
        self,
        name: str,
        created_by: str,
        description: str | None = None,
        org_id: str | None = None,
    ) -> dict[str, Any]:
        oid = org_id or f"org_{secrets.token_hex(8)}"
        with self._session() as s:
            org = SqlOrganization(
                id=oid,
                name=name,
                description=description,
                created_by=created_by,
                created_at=now_epoch(),
            )
            s.add(org)
            admin_mem = SqlOrganizationMember(
                organization_id=oid,
                user_id=created_by,
                role="admin",
                created_at=now_epoch(),
            )
            s.add(admin_mem)
            s.commit()
            return {
                "id": org.id,
                "name": org.name,
                "description": org.description,
                "created_by": org.created_by,
                "created_at": org.created_at,
            }

    def list_organizations(self, user_id: str | None = None, is_admin: bool = False) -> list[dict[str, Any]]:
        with self._session() as s:
            if is_admin or user_id is None:
                orgs = s.execute(select(SqlOrganization).order_by(SqlOrganization.created_at.desc())).scalars().all()
            else:
                orgs = s.execute(
                    select(SqlOrganization)
                    .join(SqlOrganizationMember, SqlOrganizationMember.organization_id == SqlOrganization.id)
                    .where(SqlOrganizationMember.user_id == user_id)
                    .order_by(SqlOrganization.created_at.desc())
                ).scalars().all()

            result = []
            for org in orgs:
                member_count = s.execute(
                    select(SqlOrganizationMember.user_id).where(SqlOrganizationMember.organization_id == org.id)
                ).scalars().all()
                result.append({
                    "id": org.id,
                    "name": org.name,
                    "description": org.description,
                    "created_by": org.created_by,
                    "created_at": org.created_at,
                    "member_count": len(member_count),
                })
            return result

    def get_organization(self, org_id: str) -> dict[str, Any] | None:
        with self._session() as s:
            org = s.get(SqlOrganization, org_id)
            if org is None:
                return None
            members = s.execute(
                select(SqlOrganizationMember).where(SqlOrganizationMember.organization_id == org_id)
            ).scalars().all()
            assigned_hosts = s.execute(
                select(SqlOrganizationHostAssignment.host_id).where(
                    SqlOrganizationHostAssignment.organization_id == org_id
                )
            ).scalars().all()
            return {
                "id": org.id,
                "name": org.name,
                "description": org.description,
                "created_by": org.created_by,
                "created_at": org.created_at,
                "members": [
                    {"user_id": m.user_id, "role": m.role, "created_at": m.created_at}
                    for m in members
                ],
                "assigned_hosts": list(assigned_hosts),
            }

    def delete_organization(self, org_id: str) -> bool:
        with self._session() as s:
            org = s.get(SqlOrganization, org_id)
            if org is not None:
                s.delete(org)
                s.commit()
                return True
            return False

    def add_org_member(self, org_id: str, user_id: str, role: str = "member") -> dict[str, Any]:
        with self._session() as s:
            member = s.get(SqlOrganizationMember, (org_id, user_id))
            if member is None:
                member = SqlOrganizationMember(
                    organization_id=org_id,
                    user_id=user_id,
                    role=role,
                    created_at=now_epoch(),
                )
                s.add(member)
            else:
                member.role = role
            s.commit()
            return {
                "organization_id": org_id,
                "user_id": user_id,
                "role": member.role,
                "created_at": member.created_at,
            }

    def remove_org_member(self, org_id: str, user_id: str) -> bool:
        with self._session() as s:
            member = s.get(SqlOrganizationMember, (org_id, user_id))
            if member is not None:
                s.delete(member)
                s.commit()
                return True
            return False


_global_org_store: OrganizationStore | None = None


def get_organization_store() -> OrganizationStore:
    global _global_org_store
    if _global_org_store is None:
        _global_org_store = OrganizationStore()
    return _global_org_store
