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
                Physical nodes running the Omnigent agent host daemon.
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-primary" />
              Access & Allocations: {selectedHost?.name}
            </DialogTitle>
            <DialogDescription>
              View and manage which divisions and members are authorized to execute on this runner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Assigned Divisions List */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Building2Icon className="h-3.5 w-3.5" />
                Assigned Divisions ({assignments?.organizations.length || 0})
              </h4>
              {!assignments ? (
                <div className="text-xs text-muted-foreground py-1">Loading…</div>
              ) : assignments.organizations.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center border rounded-md bg-muted/10">
                  No divisions assigned to this runner yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {assignments.organizations.map((org) => (
                    <div
                      key={org.organization_id}
                      className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-lg text-xs border"
                    >
                      <div className="flex items-center gap-2">
                        <Building2Icon className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{org.name}</span>
                        {org.allowed_models && org.allowed_models.length > 0 ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {org.allowed_models.length} model(s)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 text-emerald-600 border-emerald-600/30"
                          >
                            All Models
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
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

            {/* Quick Assign Division Form */}
            {organizations.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Assign Division to this Runner
                </label>
                <div className="flex gap-2">
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                    value={assignOrgId}
                    onChange={(e) => setAssignOrgId(e.target.value)}
                  >
                    <option value="">Select a division…</option>
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
                  <Button
                    size="sm"
                    className="h-8 text-xs whitespace-nowrap"
                    onClick={handleAssignOrg}
                    disabled={!assignOrgId || actionLoading}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            )}

            {/* Direct Users List */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5" />
                  Assigned Members ({assignments?.users.length || 0})
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
                <div className="text-xs text-muted-foreground py-2 text-center border rounded-lg bg-muted/10">
                  No individual members assigned. Members can access this runner via their division or individual execution settings.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {assignments.users.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-lg text-xs border"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{u.user_id}</span>
                        {u.allowed_models && u.allowed_models.length > 0 ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {u.allowed_models.length} model(s)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 text-emerald-600 border-emerald-600/30"
                          >
                            All Models
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => handleUnassignUser(u.user_id)}
                        disabled={actionLoading}
                        title="Revoke individual access"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedHost(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
