"""Tests for Multi-Division RBAC (Supervisor) and Workspace Isolation."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from omnigent.server.organization_store import OrganizationStore, set_organization_store
from omnigent.server.routes.hosts import _resolve_and_enforce_user_workspace


@pytest.fixture
def org_store(tmp_path: Path) -> OrganizationStore:
    db_file = tmp_path / "test_org.db"
    store = OrganizationStore(db_uri=f"sqlite:///{db_file}")
    set_organization_store(store)
    return store


class TestSupervisorRBACStore:
    def test_supervisor_assignment_and_managed_users(self, org_store: OrganizationStore) -> None:
        # Create organizations
        eng = org_store.create_organization(
            name="Engineering",
            description="Engineering Team",
            created_by="admin@example.com",
            org_id="org_eng",
        )
        fin = org_store.create_organization(
            name="Finance",
            description="Finance Team",
            created_by="admin@example.com",
            org_id="org_fin",
        )

        # Assign members and supervisors
        org_store.add_org_member("org_eng", "spv_eng@example.com", role="supervisor")
        org_store.add_org_member("org_eng", "alice@example.com", role="member")
        org_store.add_org_member("org_fin", "bob@example.com", role="member")

        # Test supervisor detection
        assert org_store.is_user_supervisor("spv_eng@example.com") is True
        assert org_store.is_user_supervisor("alice@example.com") is False
        assert org_store.is_user_supervisor("bob@example.com") is False

        # Test supervisor organization IDs
        assert org_store.get_supervisor_org_ids("spv_eng@example.com") == ["org_eng"]

        # Test supervisor managed users (should only include alice, NOT bob)
        managed = org_store.get_supervisor_managed_users("spv_eng@example.com")
        assert "alice@example.com" in managed
        assert "bob@example.com" not in managed

        # Test update member role
        updated = org_store.update_member_role("org_eng", "alice@example.com", role="supervisor")
        assert updated is not None
        assert updated["role"] == "supervisor"
        assert org_store.is_user_supervisor("alice@example.com") is True

    def test_org_invite_lifecycle(self, org_store: OrganizationStore) -> None:
        org_store.create_organization(
            name="Product",
            description="Product Team",
            created_by="admin@example.com",
            org_id="org_prod",
        )

        token = "inv_test_token_123"
        org_store.create_org_invite(
            token_id=token,
            organization_id="org_prod",
            role="member",
            created_by="spv_prod@example.com",
        )

        # Consume invite on registration
        consumed = org_store.consume_org_invite(token, "new_hire@example.com")
        assert consumed is not None
        assert consumed["organization_id"] == "org_prod"
        assert consumed["role"] == "member"

        # Verify new hire is member of Product
        orgs = org_store.get_user_organizations("new_hire@example.com")
        assert len(orgs) == 1
        assert orgs[0]["id"] == "org_prod"
        assert orgs[0]["name"] == "Product"

        # Invite token cannot be consumed twice
        consumed_again = org_store.consume_org_invite(token, "another_hire@example.com")
        assert consumed_again is None


class TestWorkspaceFolderIsolation:
    @pytest.mark.asyncio
    async def test_resolve_and_enforce_user_workspace(
        self,
        org_store: OrganizationStore,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Create organization and member
        org_store.create_organization(
            name="IT Department",
            created_by="admin@example.com",
            org_id="org_it",
        )
        org_store.add_org_member("org_it", "user1@example.com", role="member")

        # Mock HostRegistry and HostConnection
        class MockHostRegistry:
            pass

        class MockHostConn:
            pass

        mock_registry = MockHostRegistry()
        mock_conn = MockHostConn()

        import omnigent.server.routes._workspace_validation as ws_validation
        import omnigent.server.routes.hosts as hosts_module

        async def fake_ask_host_stat(*args, **kwargs):
            return {"status": "ok", "canonical_path": "/home/coder"}

        async def fake_proxy_create_dir(*args, **kwargs):
            return {"status": "ok", "path": kwargs.get("path")}

        monkeypatch.setattr(ws_validation, "_ask_host_stat", fake_ask_host_stat)
        monkeypatch.setattr(hosts_module, "_proxy_create_dir", fake_proxy_create_dir)

        # 1. Root "~" expands to isolated workspace
        resolved_root = await _resolve_and_enforce_user_workspace(
            user_id="user1@example.com",
            path="~",
            host_registry=mock_registry,  # type: ignore
            conn=mock_conn,  # type: ignore
            is_create=False,
        )
        assert resolved_root == "/home/coder/workspaces/it-department/user1"

        # 2. Subpath inside user's folder is allowed
        valid_subpath = await _resolve_and_enforce_user_workspace(
            user_id="user1@example.com",
            path="/home/coder/workspaces/it-department/user1/my-project",
            host_registry=mock_registry,  # type: ignore
            conn=mock_conn,  # type: ignore
            is_create=False,
        )
        assert valid_subpath == "/home/coder/workspaces/it-department/user1/my-project"

        # 3. Path outside user's folder (another user) raises 403
        with pytest.raises(HTTPException) as exc_info:
            await _resolve_and_enforce_user_workspace(
                user_id="user1@example.com",
                path="/home/coder/workspaces/it-department/user2/other-project",
                host_registry=mock_registry,  # type: ignore
                conn=mock_conn,  # type: ignore
                is_create=False,
            )
        assert exc_info.value.status_code == 403

        # 4. Path outside user's folder (another division) raises 403
        with pytest.raises(HTTPException) as exc_info2:
            await _resolve_and_enforce_user_workspace(
                user_id="user1@example.com",
                path="/home/coder/workspaces/finance/user1/project",
                host_registry=mock_registry,  # type: ignore
                conn=mock_conn,  # type: ignore
                is_create=False,
            )
        assert exc_info2.value.status_code == 403

        # 5. Root escape (/home/coder or /etc) raises 403
        with pytest.raises(HTTPException) as exc_info3:
            await _resolve_and_enforce_user_workspace(
                user_id="user1@example.com",
                path="/home/coder",
                host_registry=mock_registry,  # type: ignore
                conn=mock_conn,  # type: ignore
                is_create=False,
            )
        assert exc_info3.value.status_code == 403

        # 6. Prefix collision attack (/home/coder/workspaces/it-department/user1_suffix) raises 403
        with pytest.raises(HTTPException) as exc_info4:
            await _resolve_and_enforce_user_workspace(
                user_id="user1@example.com",
                path="/home/coder/workspaces/it-department/user1_suffix",
                host_registry=mock_registry,  # type: ignore
                conn=mock_conn,  # type: ignore
                is_create=False,
            )
        assert exc_info4.value.status_code == 403
