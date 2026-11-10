/**
 * Divisions & Organizations Management Page (/settings/divisions).
 *
 * Dedicated RBAC management for Organizational Divisions:
 * - Admin: Create/delete divisions, designate division supervisors, and allocate runners & models to divisions.
 * - Supervisor: View their assigned division, allocated runner machines/models, and team members.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Building2Icon,
  UsersIcon,
  ServerIcon,
  PlusIcon,
  Trash2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  CpuIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsAdmin, useIsSupervisor } from "@/hooks/useIsAdmin";
import { listUsers, type AccountListEntry } from "@/lib/accountsApi";
import {
  type OrganizationItem,
  type OrganizationDetail,
  type HostItem,
  type ReadyHarnessGroup,
  fetchOrganizations,
  fetchOrganizationDetails,
  createOrganization,
  deleteOrganization,
  addMemberToOrganization,
  removeMemberFromOrganization,
  updateOrganizationMemberRole,
  fetchHostsList,
  fetchRunnerReadyHarnesses,
  assignOrgToHost,
  unassignOrgFromHost,
} from "@/lib/runnersApi";

export function DivisionsPage() {
  const isAdmin = useIsAdmin();
  const isSupervisor = useIsSupervisor();

  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [allUsers, setAllUsers] = useState<AccountListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Division Modal
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDesc, setNewOrgDesc] = useState("");

  // Manage Division Detail Modal (Members & Supervisors)
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<OrganizationDetail | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<string>("member");

  // Assign Runner to Division Modal
  const [showAssignRunnerModal, setShowAssignRunnerModal] = useState(false);
  const [assigningOrg, setAssigningOrg] = useState<OrganizationItem | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [hostHarnesses, setHostHarnesses] = useState<ReadyHarnessGroup[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [allowAllModels, setAllowAllModels] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, hostList, usersList] = await Promise.all([
        fetchOrganizations(),
        fetchHostsList(),
        listUsers(),
      ]);
      setOrganizations(orgs);
      setHosts(hostList);
      setAllUsers(usersList ?? []);
    } catch {
      toast.error("Failed to load divisions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Create Organization
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      toast.error("Division name is required");
      return;
    }
    setActionLoading(true);
    const created = await createOrganization(newOrgName.trim(), newOrgDesc.trim() || undefined);
    setActionLoading(false);
    if (created) {
      toast.success(`Division "${created.name}" created successfully`);
      setShowCreateOrg(false);
      setNewOrgName("");
      setNewOrgDesc("");
      void loadData();
    } else {
      toast.error("Failed to create division");
    }
  };

  // Handle Delete Organization
  const handleDeleteOrg = async (org: OrganizationItem) => {
    if (!confirm(`Are you sure you want to delete division "${org.name}"? This cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    const ok = await deleteOrganization(org.id);
    setActionLoading(false);
    if (ok) {
      toast.success(`Division "${org.name}" deleted`);
      void loadData();
    } else {
      toast.error("Failed to delete division");
    }
  };

  // Open Members & Supervisor Modal
  const openManageMembers = async (org: OrganizationItem) => {
    setActionLoading(true);
    const detail = await fetchOrganizationDetails(org.id);
    setActionLoading(false);
    if (detail) {
      setSelectedOrgDetail(detail);
      setShowMembersModal(true);
    } else {
      toast.error("Failed to fetch division details");
    }
  };

  // Add Member to Division
  const handleAddMember = async () => {
    if (!selectedOrgDetail || !newMemberUsername.trim()) return;
    setActionLoading(true);
    const ok = await addMemberToOrganization(
      selectedOrgDetail.id,
      newMemberUsername.trim(),
      newMemberRole,
    );
    setActionLoading(false);
    if (ok) {
      toast.success(`Added ${newMemberUsername} to ${selectedOrgDetail.name}`);
      setNewMemberUsername("");
      setNewMemberRole("member");
      const updated = await fetchOrganizationDetails(selectedOrgDetail.id);
      setSelectedOrgDetail(updated);
      void loadData();
    } else {
      toast.error("Failed to add member to division");
    }
  };

  // Toggle Member Role between Member and Supervisor
  const handleToggleSupervisor = async (userId: string, currentRole: string) => {
    if (!selectedOrgDetail) return;
    const newRole = currentRole === "supervisor" ? "member" : "supervisor";
    setActionLoading(true);
    const ok = await updateOrganizationMemberRole(selectedOrgDetail.id, userId, newRole);
    setActionLoading(false);
    if (ok) {
      toast.success(
        newRole === "supervisor"
          ? `Promoted ${userId} to Supervisor`
          : `Reverted ${userId} to Member`,
      );
      const updated = await fetchOrganizationDetails(selectedOrgDetail.id);
      setSelectedOrgDetail(updated);
      void loadData();
    } else {
      toast.error("Failed to update role");
    }
  };

  // Remove Member from Division
  const handleRemoveMember = async (userId: string) => {
    if (!selectedOrgDetail) return;
    if (!confirm(`Remove ${userId} from ${selectedOrgDetail.name}?`)) return;
    setActionLoading(true);
    const ok = await removeMemberFromOrganization(selectedOrgDetail.id, userId);
    setActionLoading(false);
    if (ok) {
      toast.success(`Removed ${userId}`);
      const updated = await fetchOrganizationDetails(selectedOrgDetail.id);
      setSelectedOrgDetail(updated);
      void loadData();
    } else {
      toast.error("Failed to remove member");
    }
  };

  // Open Assign Runner Modal
  const openAssignRunner = async (org: OrganizationItem) => {
    setAssigningOrg(org);
    const initialHost = hosts[0]?.host_id || "";
    setSelectedHostId(initialHost);
    setAllowAllModels(true);
    setSelectedModels([]);
    if (initialHost) {
      const targetHost = hosts.find((h) => h.host_id === initialHost);
      if (targetHost) {
        const harnesses = await fetchRunnerReadyHarnesses(targetHost);
        setHostHarnesses(harnesses);
      }
    } else {
      setHostHarnesses([]);
    }
    setShowAssignRunnerModal(true);
  };

  // Host change in assign runner modal
  const handleAssignHostChange = async (hostId: string) => {
    setSelectedHostId(hostId);
    setAllowAllModels(true);
    setSelectedModels([]);
    const targetHost = hosts.find((h) => h.host_id === hostId);
    if (targetHost) {
      const harnesses = await fetchRunnerReadyHarnesses(targetHost);
      setHostHarnesses(harnesses);
    } else {
      setHostHarnesses([]);
    }
  };

  // Toggle model selection
  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  // Submit Assign Runner to Division
  const handleSaveRunnerAssignment = async () => {
    if (!assigningOrg || !selectedHostId) return;
    setActionLoading(true);
    const modelsToAssign = allowAllModels ? null : selectedModels;
    const ok = await assignOrgToHost(selectedHostId, assigningOrg.id, modelsToAssign);
    setActionLoading(false);
    if (ok) {
      toast.success(`Runner assigned to division "${assigningOrg.name}"`);
      setShowAssignRunnerModal(false);
      void loadData();
    } else {
      toast.error("Failed to assign runner to division");
    }
  };

  // Unassign Runner from Division
  const handleUnassignRunner = async (orgId: string, hostId: string) => {
    if (!confirm("Remove this runner assignment from this division?")) return;
    setActionLoading(true);
    const ok = await unassignOrgFromHost(hostId, orgId);
    setActionLoading(false);
    if (ok) {
      toast.success("Runner removed from division");
      void loadData();
    } else {
      toast.error("Failed to remove runner from division");
    }
  };

  const allAvailableModels = Array.from(
    new Set(hostHarnesses.flatMap((h) => h.models)),
  );

  return (
    <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="settings-page-title text-2xl font-medium">
            {isAdmin ? "Divisions & Departments" : "My Division"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Create organizational divisions, designate supervisors, and allocate runner machines & allowed models."
              : "Overview of your assigned division, allocated runner machines, and team members."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowCreateOrg(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Division
            </Button>
          )}
        </div>
      </div>

      {/* Division List */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Loading divisions...
        </div>
      ) : organizations.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">
          <Building2Icon className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p className="font-medium text-sm">No divisions found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? "Create a division to organize team members and delegate runner access."
              : "You are not currently assigned to any division."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map((org) => {
            const assignedHostIds = org.assigned_hosts || [];
            const assignedHostItems = hosts.filter((h) => assignedHostIds.includes(h.host_id));
            const supervisors = org.supervisors || [];

            return (
              <Card key={org.id} className="border shadow-sm">
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar: Name, Badges & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        <Building2Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-base">{org.name}</h2>
                          <Badge variant="secondary" className="text-xs">
                            {org.member_count} {org.member_count === 1 ? "member" : "members"}
                          </Badge>
                        </div>
                        {org.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{org.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => openManageMembers(org)}
                      >
                        <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
                        {isAdmin ? "Manage Members & Supervisors" : "View Members"}
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => openAssignRunner(org)}
                          >
                            <ServerIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            Allocate Runner
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteOrg(org)}
                            title="Delete Division"
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Middle: Supervisors & Allocated Runners */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Supervisors Box */}
                    <div className="rounded-md border p-3 bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Division Supervisors
                        </span>
                        <span>{supervisors.length} assigned</span>
                      </div>
                      {supervisors.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No supervisor designated yet. Use Manage Members to promote a supervisor.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {supervisors.map((spv) => (
                            <Badge
                              key={spv}
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs py-0.5"
                            >
                              <UserCheckIcon className="mr-1 h-3 w-3" />
                              {spv}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Allocated Runners Box */}
                    <div className="rounded-md border p-3 bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <ServerIcon className="h-4 w-4 text-primary" />
                          Allocated Runners & Hardware
                        </span>
                        <span>{assignedHostIds.length} allocated</span>
                      </div>
                      {assignedHostIds.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No runner allocated to this division yet.
                        </p>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          {assignedHostIds.map((hid) => {
                            const runnerHost = hosts.find((h) => h.host_id === hid);
                            const runnerName = runnerHost?.name || hid;
                            const isOnline = runnerHost?.status === "online";
                            return (
                              <div
                                key={hid}
                                className="flex items-center justify-between bg-background px-2.5 py-1.5 rounded border text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                                    }`}
                                  />
                                  <span className="font-medium">{runnerName}</span>
                                </div>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleUnassignRunner(org.id, hid)}
                                    title="Unassign Runner"
                                  >
                                    <XIcon className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE DIVISION MODAL ───────────────────────────────────── */}
      <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Division</DialogTitle>
            <DialogDescription>
              Add a new organizational division to structure team members, supervisors, and runners.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Division Name</label>
              <Input
                placeholder="e.g. Engineering, AI Research, Marketing"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Description (Optional)</label>
              <Input
                placeholder="Brief purpose of this division"
                value={newOrgDesc}
                onChange={(e) => setNewOrgDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={actionLoading || !newOrgName.trim()}>
              {actionLoading ? "Creating..." : "Create Division"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MANAGE MEMBERS & SUPERVISOR MODAL ────────────────────────── */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2Icon className="h-5 w-5 text-primary" />
              Members of {selectedOrgDetail?.name}
            </DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Manage division members and designate supervisors responsible for this division."
                : "List of team members in your division."}
            </DialogDescription>
          </DialogHeader>

          {/* Add member form (Admin or Supervisor) */}
          {(() => {
            const existingMemberIds = new Set(selectedOrgDetail?.members.map((m) => m.user_id) || []);
            const availableUsersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));
            return (
              <div className="border-y py-3 my-2 bg-muted/10 px-1 rounded flex flex-col sm:flex-row items-center gap-2">
                <div className="flex-1 w-full sm:w-auto">
                  <select
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">
                      {availableUsersToAdd.length === 0
                        ? "-- All registered users are already in this division --"
                        : "-- Select Member to Add --"}
                    </option>
                    {availableUsersToAdd.map((u) => {
                      const divInfo =
                        u.organizations && u.organizations.length > 0
                          ? u.organizations.map((o) => o.name).join(", ")
                          : "No division";
                      return (
                        <option key={u.id} value={u.id}>
                          {u.id} {isAdmin ? `(${divInfo})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {isAdmin && (
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="member">Role: Member</option>
                    <option value="supervisor">Role: Supervisor</option>
                  </select>
                )}
                <Button
                  size="sm"
                  className="h-8 text-xs whitespace-nowrap w-full sm:w-auto"
                  onClick={handleAddMember}
                  disabled={actionLoading || !newMemberUsername.trim()}
                >
                  <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                  Add Member
                </Button>
              </div>
            );
          })()}

          {/* Members list */}
          <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1">
            {selectedOrgDetail?.members.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No members in this division yet.
              </p>
            ) : (
              selectedOrgDetail?.members.map((m) => {
                const isSpv = m.role === "supervisor";
                return (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between p-2.5 rounded border bg-card text-xs hover:bg-muted/10"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center font-medium uppercase text-muted-foreground">
                        {m.user_id.slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-semibold text-sm">{m.user_id}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant={isSpv ? "default" : "secondary"}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {isSpv ? "Supervisor" : "Member"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleToggleSupervisor(m.user_id, m.role)}
                            disabled={actionLoading}
                            title={isSpv ? "Demote to Member" : "Promote to Supervisor"}
                          >
                            <ShieldCheckIcon className="mr-1 h-3.5 w-3.5 text-primary" />
                            {isSpv ? "Demote" : "Make Supervisor"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={actionLoading}
                            title="Remove from Division"
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="mt-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowMembersModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ALLOCATE RUNNER & MODELS MODAL (ADMIN ONLY) ─────────────── */}
      <Dialog open={showAssignRunnerModal} onOpenChange={setShowAssignRunnerModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-primary" />
              Allocate Runner to {assigningOrg?.name}
            </DialogTitle>
            <DialogDescription>
              Assign compute runner hardware and select the allowed model descendants for this division.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            {/* Select Host Runner */}
            <div className="space-y-1">
              <label className="text-xs font-semibold">Select Runner Machine</label>
              <select
                value={selectedHostId}
                onChange={(e) => void handleAssignHostChange(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-xs"
              >
                {hosts.map((h) => (
                  <option key={h.host_id} value={h.host_id}>
                    {h.name} ({h.status}) - {h.host_id.slice(0, 8)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Model Allocation Mode */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-semibold flex items-center justify-between">
                <span>Model Permission Policy</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Supervisor can only delegate these models
                </span>
              </label>

              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="modelMode"
                    checked={allowAllModels}
                    onChange={() => setAllowAllModels(true)}
                  />
                  <span>Allow All Models on this Runner</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="modelMode"
                    checked={!allowAllModels}
                    onChange={() => setAllowAllModels(false)}
                  />
                  <span>Restrict to Selected Models</span>
                </label>
              </div>

              {!allowAllModels && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] text-muted-foreground">
                    Check the models that Supervisor and members of this division are permitted to use:
                  </div>
                  {allAvailableModels.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No models detected on this runner.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-md p-2 max-h-48 overflow-y-auto bg-muted/10">
                      {allAvailableModels.map((model) => {
                        const checked = selectedModels.includes(model);
                        return (
                          <label
                            key={model}
                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs border ${
                              checked
                                ? "bg-primary/5 border-primary/40 font-medium"
                                : "bg-background border-border text-muted-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModel(model)}
                              className="rounded border"
                            />
                            <span className="truncate">{model}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setShowAssignRunnerModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRunnerAssignment}
              disabled={actionLoading || !selectedHostId}
            >
              {actionLoading ? "Allocating..." : "Confirm Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
