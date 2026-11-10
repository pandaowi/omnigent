"""REST API routes for Organization and Team Management (``/v1/organizations``)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from omnigent.server.auth import AuthProvider
from omnigent.server.routes._auth_helpers import require_user
from omnigent.server.organization_store import get_organization_store
from omnigent.stores.permission_store import PermissionStore

_logger = logging.getLogger(__name__)


class CreateOrganizationRequest(BaseModel):
    name: str
    description: str | None = None
    id: str | None = None


class UpdateUserExecutionRequest(BaseModel):
    host_id: str | None = None
    allowed_models: list[str] | None = None
    harness: str | None = None
    default_model: str | None = None
    allowed_harnesses: list[str] | None = None


class AddMemberRequest(BaseModel):
    username: str
    role: str = "member"


class UpdateMemberRoleRequest(BaseModel):
    role: str


def create_organizations_router(
    *,
    auth_provider: AuthProvider | None = None,
    permission_store: PermissionStore | None = None,
    db_uri: str | None = None,
) -> APIRouter:
    router = APIRouter(tags=["organizations"])
    org_store = get_organization_store(db_uri=db_uri)

    def _require_admin(request: Request) -> str:
        user_id = require_user(request, auth_provider)
        if not user_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        is_admin = permission_store.is_admin(user_id) if permission_store else False
        if not is_admin:
            raise HTTPException(status_code=403, detail="admin privileges required")
        return user_id

    @router.get("/organizations")
    async def list_organizations(request: Request) -> dict[str, list[dict[str, Any]]]:
        """List organizations the user belongs to, or all if admin."""
        user_id = require_user(request, auth_provider)
        if not user_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        is_admin = permission_store.is_admin(user_id) if permission_store else False
        orgs = await asyncio.to_thread(org_store.list_organizations, user_id, is_admin)
        return {"organizations": orgs}

    @router.post("/organizations", status_code=201)
    async def create_organization(request: Request, body: CreateOrganizationRequest) -> dict[str, Any]:
        """Create a new organization (Admin only)."""
        admin_id = _require_admin(request)
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="organization name cannot be empty")
        org = await asyncio.to_thread(
            org_store.create_organization,
            name=body.name.strip(),
            created_by=admin_id,
            description=body.description,
            org_id=body.id,
        )
        return org

    @router.get("/organizations/{org_id}")
    async def get_organization(request: Request, org_id: str) -> dict[str, Any]:
        """Get organization detail with members and assigned hosts."""
        user_id = require_user(request, auth_provider)
        if not user_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        org = await asyncio.to_thread(org_store.get_organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="organization not found")
        is_admin = permission_store.is_admin(user_id) if permission_store else False
        is_member = any(m["user_id"] == user_id for m in org.get("members", []))
        if not is_admin and not is_member:
            raise HTTPException(status_code=403, detail="not a member of this organization")
        return org

    @router.delete("/organizations/{org_id}")
    async def delete_organization(request: Request, org_id: str) -> dict[str, bool]:
        """Delete an organization (Admin only)."""
        _require_admin(request)
        deleted = await asyncio.to_thread(org_store.delete_organization, org_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="organization not found")
        return {"ok": True}

    @router.post("/organizations/{org_id}/members", status_code=201)
    async def add_organization_member(request: Request, org_id: str, body: AddMemberRequest) -> dict[str, Any]:
        """Add a user to an organization (Admin only)."""
        _require_admin(request)
        member = await asyncio.to_thread(
            org_store.add_org_member,
            org_id=org_id,
            user_id=body.username.strip(),
            role=body.role,
        )
        return member

    @router.put("/organizations/{org_id}/members/{member_user_id}/role")
    async def update_org_member_role(
        request: Request,
        org_id: str,
        member_user_id: str,
        body: UpdateMemberRoleRequest,
    ) -> dict[str, Any]:
        """Update role of an organization member (Admin or Supervisor of this org)."""
        user_id = require_user(request, auth_provider)
        if not user_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        is_admin = permission_store.is_admin(user_id) if permission_store else False
        is_spv = org_store.is_user_supervisor(user_id, org_id)
        if not is_admin and not is_spv:
            raise HTTPException(status_code=403, detail="admin or organization supervisor required")
        if not is_admin and body.role not in ("member",):
            raise HTTPException(status_code=403, detail="only global admin can designate supervisors")
        updated = await asyncio.to_thread(
            org_store.update_member_role,
            org_id=org_id,
            user_id=member_user_id.strip(),
            role=body.role.strip(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="member not found in organization")
        return updated

    @router.delete("/organizations/{org_id}/members/{member_user_id}")
    async def remove_organization_member(request: Request, org_id: str, member_user_id: str) -> dict[str, bool]:
        """Remove a user from an organization (Admin only)."""
        _require_admin(request)
        removed = await asyncio.to_thread(org_store.remove_org_member, org_id, member_user_id)
        if not removed:
            raise HTTPException(status_code=404, detail="member not found in organization")
        return {"ok": True}

    @router.post("/organizations/{org_id}/hosts/{host_id}", status_code=201)
    async def assign_host_to_organization(
        request: Request,
        org_id: str,
        host_id: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Assign a host runner to an organization (Admin only)."""
        _require_admin(request)
        allowed_models = body.get("allowed_models") if body else None
        assignment = await asyncio.to_thread(
            org_store.assign_org_to_host,
            host_id=host_id,
            organization_id=org_id,
            allowed_models=allowed_models,
        )
        return assignment

    @router.delete("/organizations/{org_id}/hosts/{host_id}")
    async def unassign_host_from_organization(request: Request, org_id: str, host_id: str) -> dict[str, bool]:
        """Unassign a host runner from an organization (Admin only)."""
        _require_admin(request)
        removed = await asyncio.to_thread(org_store.unassign_org_from_host, host_id=host_id, organization_id=org_id)
        if not removed:
            raise HTTPException(status_code=404, detail="host not assigned to this organization")
        return {"ok": True}

    @router.get("/users/execution-overview")
    async def get_execution_overview(request: Request) -> dict[str, Any]:
        """Get host assignments and allowed models for users (Admin or Supervisor)."""
        caller_id = require_user(request, auth_provider)
        if not caller_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        is_admin = permission_store.is_admin(caller_id) if permission_store else False
        is_spv = org_store.is_user_supervisor(caller_id)
        if not is_admin and not is_spv:
            raise HTTPException(status_code=403, detail="admin or supervisor privileges required")

        all_assignments = await asyncio.to_thread(org_store.get_all_user_host_assignments)
        if is_admin:
            filtered = all_assignments
        else:
            managed_user_ids = set(org_store.get_supervisor_managed_users(caller_id))
            filtered = {
                uid: setting
                for uid, setting in all_assignments.items()
                if uid in managed_user_ids or uid == caller_id
            }
        return {"overview": filtered, "users": filtered}

    @router.get("/users/me/execution")
    async def get_my_execution(request: Request) -> dict[str, Any]:
        """Get the current authenticated user's execution assignment."""
        user_id = require_user(request, auth_provider)
        if not user_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        assignment = await asyncio.to_thread(org_store.get_user_execution_assignment, user_id)
        return {"execution": assignment}

    @router.put("/users/{target_user_id}/execution")
    async def update_user_execution(
        request: Request,
        target_user_id: str,
        body: UpdateUserExecutionRequest,
    ) -> dict[str, Any]:
        """Set assigned runner and model permissions for a user (Admin or Supervisor for their division)."""
        caller_id = require_user(request, auth_provider)
        if not caller_id:
            raise HTTPException(status_code=401, detail="unauthorized")
        is_admin = permission_store.is_admin(caller_id) if permission_store else False
        is_spv = org_store.is_user_supervisor(caller_id)
        if not is_admin and not is_spv:
            raise HTTPException(status_code=403, detail="admin or supervisor privileges required")

        # Supervisor Guardrails:
        if not is_admin:
            # Check target is a member of supervisor's division
            managed = set(org_store.get_supervisor_managed_users(caller_id))
            if target_user_id not in managed:
                raise HTTPException(status_code=403, detail="you can only manage execution for members in your division")
            # If host_id is specified, verify it's assigned to the supervisor's division
            if body.host_id:
                spv_org_ids = org_store.get_supervisor_org_ids(caller_id)
                allowed_hosts = set()
                host_org_id = None
                for org_id in spv_org_ids:
                    hosts = org_store.get_org_hosts(org_id)
                    if body.host_id in hosts:
                        allowed_hosts.add(body.host_id)
                        host_org_id = org_id
                if body.host_id not in allowed_hosts:
                    raise HTTPException(status_code=403, detail="host is not assigned to your division")

                # Enforce model and harness subset from admin's division assignment
                if host_org_id:
                    host_details = org_store.get_org_host_details(host_org_id, body.host_id)
                    if host_details:
                        div_models = host_details.get("allowed_models")
                        if div_models:
                            div_models_set = set(div_models)
                            if body.allowed_models and not set(body.allowed_models).issubset(div_models_set):
                                raise HTTPException(
                                    status_code=403,
                                    detail="allowed models must be a subset of models assigned by admin to your division",
                                )
                            if body.default_model and body.default_model not in div_models_set:
                                raise HTTPException(
                                    status_code=403,
                                    detail=f"default model '{body.default_model}' is not in the models assigned to your division",
                                )

        result = await asyncio.to_thread(
            org_store.set_user_host_execution,
            user_id=target_user_id.strip(),
            host_id=body.host_id.strip() if body.host_id else None,
            allowed_models=body.allowed_models,
            assigned_by=caller_id,
            harness=body.harness.strip() if body.harness else None,
            default_model=body.default_model.strip() if body.default_model else None,
            allowed_harnesses=body.allowed_harnesses,
        )
        return result

    return router
