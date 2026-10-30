/**
 * Admin Runners & Organizations Management Page (/settings/runners).
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ServerIcon,
  UsersIcon,
  PlusIcon,
  Trash2Icon,
  ShieldCheckIcon,
  BuildingIcon,
  UserCheckIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentIsAdmin } from "@/lib/identity";
import {
  type HostItem,
  type HostAssignments,
  type OrganizationItem,
  fetchHostsList,
  fetchHostAssignments,
  assignUserToHost,
  unassignUserFromHost,
  assignOrgToHost,
  unassignOrgFromHost,
  fetchOrganizations,
  createOrganization,
  deleteOrganization,
  addMemberToOrganization,
  removeMemberFromOrganization,
} from "@/lib/runnersApi";
import { listUsers, type AccountListEntry } from "@/lib/accountsApi";

export function RunnersManagementPage() {
  const navigate = useNavigate();
  const isAdmin = getCurrentIsAdmin();
  const [activeTab, setActiveTab] = useState<"runners" | "organizations">("runners");

  // Data states
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [allUsers, setAllUsers] = useState<AccountListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states for Host Assignment
  const [selectedHost, setSelectedHost] = useState<HostItem | null>(null);
  const [assignments, setAssignments] = useState<HostAssignments | null>(null);
  const [assignUsername, setAssignUsername] = useState("");
  const [assignOrgId, setAssignOrgId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states for Organizations
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDesc, setNewOrgDesc] = useState("");

  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);
  const [newMemberUsername, setNewMemberUsername] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [fetchedHosts, fetchedOrgs, fetchedUsers] = await Promise.all([
      fetchHostsList(),
      fetchOrganizations(),
      listUsers(),
    ]);
    setHosts(fetchedHosts);
    setOrganizations(fetchedOrgs);
    if (fetchedUsers) setAllUsers(fetchedUsers);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadData();
    }
  }, [isAdmin, loadData]);

  // Load assignments when host dialog opens
  const openHostAssignments = async (host: HostItem) => {
    setSelectedHost(host);
    setAssignments(null);
    setAssignUsername("");
    setAssignOrgId("");
    const data = await fetchHostAssignments(host.host_id);
    setAssignments(data);
  };

  const handleAssignUser = async () => {
    if (!selectedHost || !assignUsername.trim()) return;
    setActionLoading(true);
    const ok = await assignUserToHost(selectedHost.host_id, assignUsername.trim());
    setActionLoading(false);
    if (ok) {
      toast.success(`User ${assignUsername} assigned to runner successfully`);
      setAssignUsername("");
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to assign user to runner");
    }
  };

  const handleUnassignUser = async (username: string) => {
    if (!selectedHost) return;
    setActionLoading(true);
    const ok = await unassignUserFromHost(selectedHost.host_id, username);
    setActionLoading(false);
    if (ok) {
      toast.success(`Access removed for ${username}`);
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to unassign user");
    }
  };

  const handleAssignOrg = async () => {
    if (!selectedHost || !assignOrgId) return;
    setActionLoading(true);
    const ok = await assignOrgToHost(selectedHost.host_id, assignOrgId);
    setActionLoading(false);
    if (ok) {
      toast.success("Organization assigned to runner");
      setAssignOrgId("");
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to assign organization");
    }
  };

  const handleUnassignOrg = async (orgId: string) => {
    if (!selectedHost) return;
    setActionLoading(true);
    const ok = await unassignOrgFromHost(selectedHost.host_id, orgId);
    setActionLoading(false);
    if (ok) {
      toast.success("Organization access removed");
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to unassign organization");
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setActionLoading(true);
    const created = await createOrganization(newOrgName.trim(), newOrgDesc.trim() || undefined);
    setActionLoading(false);
    if (created) {
      toast.success(`Organization ${created.name} created!`);
      setShowCreateOrg(false);
      setNewOrgName("");
      setNewOrgDesc("");
      void loadData();
    } else {
      toast.error("Failed to create organization");
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete organization "${orgName}"?`)) return;
    const ok = await deleteOrganization(orgId);
    if (ok) {
      toast.success("Organization deleted");
      void loadData();
    } else {
      toast.error("Failed to delete organization");
    }
  };

  const handleAddOrgMember = async () => {
    if (!selectedOrg || !newMemberUsername.trim()) return;
    setActionLoading(true);
    const ok = await addMemberToOrganization(selectedOrg.id, newMemberUsername.trim());
    setActionLoading(false);
    if (ok) {
      toast.success(`Added ${newMemberUsername} to ${selectedOrg.name}`);
      setNewMemberUsername("");
      void loadData();
      setSelectedOrg(null);
    } else {
      toast.error("Failed to add member");
    }
  };

  if (!isAdmin) {
    return (
      <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        <h1 className="settings-page-title mb-2 text-2xl font-medium">Runners & Organizations</h1>
        <p className="text-muted-foreground">Admin privileges required to manage runners and organizations.</p>
      </PageScroll>
    );
  }

  return (
    <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="settings-page-title text-2xl font-medium">Runners & Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign runners to specific users or teams to collaborate securely in isolated workspaces.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[360px]">
          <TabsTrigger value="runners" className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4" />
            Runners ({hosts.length})
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <BuildingIcon className="h-4 w-4" />
            Organizations ({organizations.length})
          </TabsTrigger>
        </TabsList>

        {/* ── RUNNERS TAB ────────────────────────────────────────── */}
        <TabsContent value="runners" className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-medium text-sm">Connected Host Runners</h3>
              <p className="text-xs text-muted-foreground">
                Runners currently registered with the server. Assign access to users or teams.
              </p>
            </div>
            {hosts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No runners connected. Start a runner with <code className="bg-muted px-1.5 py-0.5 rounded">omni host</code> to get started.
              </div>
            ) : (
              <div className="divide-y">
                {hosts.map((host) => (
                  <div key={host.host_id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{host.name}</span>
                        <Badge variant={host.status === "online" ? "default" : "secondary"} className="text-xs">
                          {host.status === "online" ? (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            "Offline"
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Owner: {host.owner}</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        ID: {host.host_id}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openHostAssignments(host)}>
                      <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
                      Assigned Users
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── ORGANIZATIONS TAB ──────────────────────────────────── */}
        <TabsContent value="organizations" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Teams group users together so they automatically share assigned host runners.
            </p>
            <Button size="sm" onClick={() => setShowCreateOrg(true)}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Organization
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            {organizations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No organizations created yet. Click "New Organization" to create one.
              </div>
            ) : (
              <div className="divide-y">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{org.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {org.member_count} {org.member_count === 1 ? "member" : "members"}
                        </Badge>
                      </div>
                      {org.description && (
                        <p className="text-xs text-muted-foreground">{org.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Created by: {org.created_by}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrg(org)}
                      >
                        <UserCheckIcon className="mr-1.5 h-3.5 w-3.5" />
                        Add Member
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteOrg(org.id, org.name)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── MODAL: MANAGE HOST ASSIGNMENTS ─────────────────────── */}
      <Dialog open={selectedHost !== null} onOpenChange={(open) => !open && setSelectedHost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-primary" />
              Assigned Members: {selectedHost?.name}
            </DialogTitle>
            <DialogDescription>
              View members and teams with access to this runner. To allocate harnesses and models, configure them in Members settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Direct Users List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Users ({assignments?.users.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHost(null);
                    navigate("/settings/members");
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <SlidersHorizontalIcon className="h-3 w-3" />
                  Manage in Members
                </button>
              </div>
              {!assignments ? (
                <div className="text-xs text-muted-foreground py-2">Loading assignments…</div>
              ) : assignments.users.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center border rounded-lg bg-muted/10">
                  No members assigned to this runner yet. Assign members from{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHost(null);
                      navigate("/settings/members");
                    }}
                    className="text-primary underline font-medium"
                  >
                    Settings &gt; Members
                  </button>
                  .
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {assignments.users.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg text-sm border border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                          {u.user_id.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-mono font-medium">{u.user_id}</span>
                        {u.allowed_models && u.allowed_models.length > 0 ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {u.allowed_models.length} model(s)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 text-emerald-500 border-emerald-500/30">
                            All Models
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => handleUnassignUser(u.user_id)}
                        disabled={actionLoading}
                        title="Revoke access"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Organizations List */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Assigned Organizations ({assignments?.organizations.length || 0})
              </h4>
              {!assignments ? null : assignments.organizations.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">No organizations assigned yet.</div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {assignments.organizations.map((org) => (
                    <div key={org.organization_id} className="flex items-center justify-between bg-muted/40 px-3 py-1.5 rounded-lg text-sm border border-border/40">
                      <div className="flex items-center gap-2">
                        <BuildingIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => handleUnassignOrg(org.organization_id)}
                        disabled={actionLoading}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign Org Form (Optional for teams) */}
            {organizations.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <label className="text-xs font-medium text-foreground">Assign Team / Organization</label>
                <div className="flex gap-2">
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={assignOrgId}
                    onChange={(e) => setAssignOrgId(e.target.value)}
                  >
                    <option value="">Select an organization…</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAssignOrg} disabled={actionLoading || !assignOrgId}>
                    Assign Org
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="text-primary hover:text-primary flex items-center gap-1.5 w-full sm:w-auto"
              onClick={() => {
                setSelectedHost(null);
                navigate("/settings/members");
              }}
            >
              <UsersIcon className="h-3.5 w-3.5" />
              Go to Members Settings &rarr;
            </Button>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setSelectedHost(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: CREATE ORGANIZATION ─────────────────────────── */}
      <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Teams allow shared access to assigned runners for all team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Organization Name</label>
              <Input
                placeholder="e.g. Frontend Team"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description (Optional)</label>
              <Input
                placeholder="Brief description of the team's scope"
                value={newOrgDesc}
                onChange={(e) => setNewOrgDesc(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOrg(false)}>Cancel</Button>
            <Button onClick={handleCreateOrg} disabled={actionLoading || !newOrgName.trim()}>
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ADD ORG MEMBER ──────────────────────────────── */}
      <Dialog open={selectedOrg !== null} onOpenChange={(open) => !open && setSelectedOrg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member to {selectedOrg?.name}</DialogTitle>
            <DialogDescription>
              Enter the username of the member you want to add to this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium">Username</label>
            <Input
              placeholder="e.g. userdemo"
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrg(null)}>Cancel</Button>
            <Button onClick={handleAddOrgMember} disabled={actionLoading || !newMemberUsername.trim()}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
