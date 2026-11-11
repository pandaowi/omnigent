/**
 * Admin Runners Management Page (/settings/runners).
 *
 * Dedicated Machine Management:
 * Physical runner machines, compute nodes, and hardware execution environments.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ServerIcon,
  UsersIcon,
  Building2Icon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  unassignUserFromHost,
  assignOrgToHost,
  unassignOrgFromHost,
  fetchOrganizations,
} from "@/lib/runnersApi";

export function RunnersManagementPage() {
  const navigate = useNavigate();
  const isAdmin = getCurrentIsAdmin();

  // Data states
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states for Host Assignment
  const [selectedHost, setSelectedHost] = useState<HostItem | null>(null);
  const [assignments, setAssignments] = useState<HostAssignments | null>(null);
  const [assignOrgId, setAssignOrgId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedHosts, fetchedOrgs] = await Promise.all([
        fetchHostsList(),
        fetchOrganizations(),
      ]);
      setHosts(fetchedHosts);
      setOrganizations(fetchedOrgs);
    } catch {
      toast.error("Failed to load runners data");
    } finally {
      setLoading(false);
    }
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
    setAssignOrgId("");
    const data = await fetchHostAssignments(host.host_id);
    setAssignments(data);
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
      toast.success("Division assigned to runner");
      setAssignOrgId("");
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to assign division");
    }
  };

  const handleUnassignOrg = async (orgId: string) => {
    if (!selectedHost) return;
    setActionLoading(true);
    const ok = await unassignOrgFromHost(selectedHost.host_id, orgId);
    setActionLoading(false);
    if (ok) {
      toast.success("Division access removed");
      const updated = await fetchHostAssignments(selectedHost.host_id);
      setAssignments(updated);
    } else {
      toast.error("Failed to unassign division");
    }
  };

  if (!isAdmin) {
    return (
      <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        <h1 className="settings-page-title mb-2 text-2xl font-medium">Runners</h1>
        <p className="text-muted-foreground">Admin privileges required to manage runners.</p>
      </PageScroll>
    );
  }

  return (
    <PageScroll maxWidthClassName="max-w-4xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="settings-page-title text-2xl font-medium">Runners (Machine Management)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connected host runners and hardware compute nodes. Manage physical infrastructure and allocate runner access to divisions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Runners List */}
      <div className="space-y-4">
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-primary" />
                Connected Host Runners ({hosts.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Physical nodes running the IPLabs Agent Platform host daemon.
              </p>
            </div>
          </div>

          {hosts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <ServerIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="font-medium">No runners connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a runner with <code className="bg-muted px-1.5 py-0.5 rounded font-mono">omni host</code> to connect a compute node.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {hosts.map((host) => {
                const isOnline = host.status === "online";
                return (
                  <div
                    key={host.host_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm">{host.name}</span>
                        <Badge
                          variant={isOnline ? "default" : "secondary"}
                          className="text-xs py-0.5"
                        >
                          {isOnline ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                              Offline
                            </span>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Owner: <span className="font-mono">{host.owner}</span>
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Host ID: {host.host_id}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => openHostAssignments(host)}
                      >
                        <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
                        Manage Access & Assignments
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: MANAGE HOST ASSIGNMENTS ─────────────────────── */}
      <Dialog open={selectedHost !== null} onOpenChange={(open) => !open && setSelectedHost(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <ServerIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span>{selectedHost?.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        selectedHost?.status === "online"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${selectedHost?.status === "online" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      {selectedHost?.status === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono font-normal mt-0.5">
                    Host ID: {selectedHost?.host_id}
                  </p>
                </div>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Configure organizational divisions and individual users permitted to run workloads on this compute machine.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
            {/* ── SECTION 1: DIVISIONS ALLOCATION ── */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Building2Icon className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Assigned Divisions
                  </h4>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5 font-semibold">
                    {assignments?.organizations.length || 0}
                  </Badge>
                </div>
              </div>

              {!assignments ? (
                <div className="text-xs text-muted-foreground py-4 text-center">Loading division assignments…</div>
              ) : assignments.organizations.length === 0 ? (
                <div className="text-xs text-muted-foreground py-5 text-center border border-dashed rounded-lg bg-muted/10">
                  No divisions assigned to this runner yet. Assign a division below to allow its supervisors and members access.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {assignments.organizations.map((org) => (
                    <div
                      key={org.organization_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Building2Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-xs truncate text-foreground">{org.name}</span>
                        </div>
                        <div>
                          {org.allowed_models && org.allowed_models.length > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                              {org.allowed_models.length} model(s) restricted
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              All Models Allowed
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                        onClick={() => handleUnassignOrg(org.organization_id)}
                        disabled={actionLoading}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Assign Division Bar */}
              {organizations.length > 0 && (
                <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 w-full sm:w-auto">
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      value={assignOrgId}
                      onChange={(e) => setAssignOrgId(e.target.value)}
                    >
                      <option value="">-- Choose Division to Allocate --</option>
                      {organizations
                        .filter(
                          (org) =>
                            !assignments?.organizations.some(
                              (ao) => ao.organization_id === org.id,
                            ),
                        )
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-9 px-4 text-xs font-medium whitespace-nowrap w-full sm:w-auto"
                    onClick={handleAssignOrg}
                    disabled={!assignOrgId || actionLoading}
                  >
                    Allocate Division
                  </Button>
                </div>
              )}
            </div>

            {/* ── SECTION 2: DIRECT MEMBERS ACCESS ── */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Direct Member Overrides
                  </h4>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5 font-semibold">
                    {assignments?.users.length || 0}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHost(null);
                    navigate("/settings/members");
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <SlidersHorizontalIcon className="h-3 w-3" />
                  Manage in Members Settings
                </button>
              </div>

              {!assignments ? (
                <div className="text-xs text-muted-foreground py-4 text-center">Loading member assignments…</div>
              ) : assignments.users.length === 0 ? (
                <div className="text-xs text-muted-foreground py-5 text-center border border-dashed rounded-lg bg-muted/10">
                  No individual member overrides. Members inherit access automatically through their assigned divisions.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {assignments.users.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                            {u.user_id.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-mono font-semibold text-xs truncate text-foreground">{u.user_id}</span>
                        </div>
                        <div>
                          {u.allowed_models && u.allowed_models.length > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                              {u.allowed_models.length} model(s) allowed
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              All Models Allowed
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                        onClick={() => handleUnassignUser(u.user_id)}
                        disabled={actionLoading}
                        title="Revoke individual override"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setSelectedHost(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
