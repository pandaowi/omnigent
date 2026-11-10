/**
 * Admin members management page (``/settings/members``).
 * Full page view for Member Execution Settings (Runtime/Runner and Model assignments).
 * Designed for IPLabs Agent Platform with theme-matching dark glassmorphic styling,
 * responsive cards, ambient lighting, and comprehensive execution controls.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BuildingIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  CpuIcon,
  InfoIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageScroll } from "@/components/PageScroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type AccountListEntry,
  type InviteCreated,
  type PasswordReset,
  createInvite,
  deleteUser,
  listUsers,
  resetUserPassword,
} from "@/lib/accountsApi";
import {
  type HostItem,
  type ReadyHarnessGroup,
  type UserExecutionSetting,
  type OrganizationItem,
  fetchHostsList,
  fetchExecutionOverview,
  updateUserExecution,
  fetchRunnerReadyHarnesses,
  fetchOrganizations,
} from "@/lib/runnersApi";
import { getCurrentIsAdmin, getCurrentIsSupervisor, resolveIdentity } from "@/lib/identity";
import { useServerInfo } from "@/lib/CapabilitiesContext";
import { isSingleUserMode } from "@/lib/capabilities";
import { withBasePath } from "@/lib/basePath";
import { relativeTime, absoluteTime } from "@/lib/relativeTime";

export function MembersPage() {
  const info = useServerInfo();
  const isSingleUser = isSingleUserMode(info);
  const manageable = info !== "loading" && info.accounts_enabled;

  const [meId, setMeId] = useState<string | null>(null);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [users, setUsers] = useState<AccountListEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Organizations & Divisions
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [inviteOrgId, setInviteOrgId] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<string>("member");

  // Execution overview, hosts & ready runtimes
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [executionMap, setExecutionMap] = useState<Record<string, UserExecutionSetting>>({});

  // Active Member for Dedicated Execution Page View
  const [selectedMember, setSelectedMember] = useState<AccountListEntry | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [detectedHarnesses, setDetectedHarnesses] = useState<ReadyHarnessGroup[]>([]);
  const [enabledHarnesses, setEnabledHarnesses] = useState<string[]>([]);
  const [defaultHarness, setDefaultHarness] = useState<string>("antigravity-native");
  const [harnessModelModes, setHarnessModelModes] = useState<Record<string, "all" | "custom">>({});
  const [harnessSelectedModels, setHarnessSelectedModels] = useState<Record<string, string[]>>({});
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<Record<string, string>>({});

  // Dialogs
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteAsAdmin, setInviteAsAdmin] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteCreated | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [resetResult, setResetResult] = useState<PasswordReset | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AccountListEntry | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  // Allowed hosts for supervisor (scoped to their division(s))
  const displayHosts = useMemo<HostItem[]>(() => {
    if (meIsAdmin) return hosts;
    const allowed = new Set<string>();
    for (const org of organizations) {
      if (org.assigned_hosts) {
        for (const hid of org.assigned_hosts) allowed.add(hid);
      }
    }
    return hosts.filter((h) => allowed.has(h.host_id));
  }, [meIsAdmin, hosts, organizations]);

  // Refresh users, execution assignments, and organizations
  const refreshUsers = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [data, hostsData, execOverview, orgsData] = await Promise.all([
        listUsers().catch(() => null),
        fetchHostsList().catch(() => []),
        fetchExecutionOverview().catch(() => ({})),
        fetchOrganizations().catch(() => []),
      ]);
      setUsers(data ?? []);
      setHosts(hostsData ?? []);
      setExecutionMap(execOverview ?? {});
      setOrganizations(orgsData ?? []);
      if (orgsData && orgsData.length > 0) {
        setInviteOrgId((prev) => prev || orgsData[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load: identity probe + members list
  useEffect(() => {
    if (isSingleUser) return;
    let unmounted = false;
    void (async () => {
      const userId = await resolveIdentity();
      if (unmounted) return;
      if (userId === null) {
        // Not authenticated — resolveIdentity already redirects when one exists.
        return;
      }
      setMeId(userId);
      const admin = typeof getCurrentIsAdmin === "function" ? getCurrentIsAdmin() : false;
      const spv =
        typeof getCurrentIsSupervisor === "function" ? getCurrentIsSupervisor() : false;
      setMeIsAdmin(admin);
      setIsSupervisor(spv);
      if (admin || spv) {
        await refreshUsers();
      }
    })();
    return () => {
      unmounted = true;
    };
  }, [isSingleUser, refreshUsers]);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = u.id.toLowerCase().includes(q);
        const matchOrg = u.organizations?.some((o) => o.name.toLowerCase().includes(q));
        if (!matchId && !matchOrg) return false;
      }
      if (filterDivision !== "all") {
        const inOrg = u.organizations?.some((o) => o.id === filterDivision);
        if (!inOrg) return false;
      }
      if (filterRole === "admin" && !u.is_admin) return false;
      if (filterRole === "supervisor") {
        const isSpv = u.organizations?.some(
          (o) => o.role === "supervisor" || o.role === "admin" || o.role === "lead",
        );
        if (!isSpv) return false;
      }
      if (filterRole === "member") {
        if (u.is_admin) return false;
        const isSpv = u.organizations?.some(
          (o) => o.role === "supervisor" || o.role === "admin" || o.role === "lead",
        );
        if (isSpv) return false;
      }
      return true;
    });
  }, [users, searchQuery, filterDivision, filterRole]);

  // Open member execution settings page
  const openMemberExecution = async (u: AccountListEntry) => {
    setSelectedMember(u);
    const exec = executionMap[u.id];
    const hostPool = meIsAdmin ? hosts : displayHosts;
    const hostId = exec?.host_id || (hostPool.length > 0 ? hostPool[0].host_id : "");
    setSelectedHostId(hostId);

    const targetHost = hosts.find((h) => h.host_id === hostId);
    let readyHarnesses: ReadyHarnessGroup[] = [];
    if (targetHost) {
      readyHarnesses = await fetchRunnerReadyHarnesses(targetHost);
    }
    setDetectedHarnesses(readyHarnesses);

    // Initial enabled harnesses
    let initialEnabled: string[] = [];
    if (exec?.allowed_harnesses && exec.allowed_harnesses.length > 0) {
      initialEnabled = exec.allowed_harnesses;
    } else if (exec?.harness) {
      initialEnabled = [exec.harness];
    } else {
      initialEnabled = readyHarnesses.map((rh) =>
        rh.harnessKey === "antigravity"
          ? "antigravity-native"
          : rh.harnessKey === "codex"
          ? "codex-native"
          : `${rh.harnessKey}-native`,
      );
    }
    setEnabledHarnesses(initialEnabled);

    // Default harness
    const dHarness = exec?.harness || initialEnabled[0] || "antigravity-native";
    setDefaultHarness(dHarness);

    // Model modes and selected models per harness
    const modes: Record<string, "all" | "custom"> = {};
    const selected: Record<string, string[]> = {};

    for (const rh of readyHarnesses) {
      const hKey = rh.harnessKey;
      const hNative =
        hKey === "antigravity"
          ? "antigravity-native"
          : hKey === "codex"
          ? "codex-native"
          : `${hKey}-native`;

      if (exec?.allowed_models && exec.allowed_models.length > 0) {
        const matching = exec.allowed_models.filter((m) => rh.models.includes(m));
        if (matching.length > 0) {
          modes[hNative] = "custom";
          selected[hNative] = matching;
        } else {
          modes[hNative] = initialEnabled.includes(hNative) ? "all" : "custom";
          selected[hNative] = [];
        }
      } else {
        modes[hNative] = "all";
        selected[hNative] = [];
      }
    }

    setHarnessModelModes(modes);
    setHarnessSelectedModels(selected);
    setDefaultModel(exec?.default_model || "");
  };

  // Handle Host Change
  const handleHostChange = async (newHostId: string) => {
    setSelectedHostId(newHostId);
    const targetHost = hosts.find((h) => h.host_id === newHostId);
    let readyHarnesses: ReadyHarnessGroup[] = [];
    if (targetHost) {
      readyHarnesses = await fetchRunnerReadyHarnesses(targetHost);
    }
    setDetectedHarnesses(readyHarnesses);
    const enabled = readyHarnesses.map((rh) =>
      rh.harnessKey === "antigravity"
        ? "antigravity-native"
        : rh.harnessKey === "codex"
        ? "codex-native"
        : `${rh.harnessKey}-native`,
    );
    setEnabledHarnesses(enabled);
    setDefaultHarness(enabled[0] || "antigravity-native");

    const modes: Record<string, "all" | "custom"> = {};
    const selected: Record<string, string[]> = {};
    for (const rh of readyHarnesses) {
      const hNative =
        rh.harnessKey === "antigravity"
          ? "antigravity-native"
          : rh.harnessKey === "codex"
          ? "codex-native"
          : `${rh.harnessKey}-native`;
      modes[hNative] = "all";
      selected[hNative] = [];
    }
    setHarnessModelModes(modes);
    setHarnessSelectedModels(selected);
    setDefaultModel(readyHarnesses[0]?.models[0] || "");
  };

  // Toggle harness on/off
  const toggleHarness = (harnessNative: string) => {
    setEnabledHarnesses((prev) => {
      const exists = prev.includes(harnessNative);
      const next = exists ? prev.filter((h) => h !== harnessNative) : [...prev, harnessNative];
      if (defaultHarness === harnessNative && exists) {
        setDefaultHarness(next[0] || "");
      } else if (!exists && prev.length === 0) {
        setDefaultHarness(harnessNative);
      }
      return next;
    });
  };

  // Set model mode for a harness
  const setHarnessMode = (
    harnessNative: string,
    mode: "all" | "custom",
    defaultModelList: string[],
  ) => {
    setHarnessModelModes((prev) => ({ ...prev, [harnessNative]: mode }));
    if (mode === "custom") {
      setHarnessSelectedModels((prev) => {
        if (!prev[harnessNative] || prev[harnessNative].length === 0) {
          return { ...prev, [harnessNative]: defaultModelList.slice(0, 2) };
        }
        return prev;
      });
    }
  };

  // Toggle model checkbox for a harness
  const toggleModelForHarness = (harnessNative: string, modelId: string) => {
    setHarnessSelectedModels((prev) => {
      const current = prev[harnessNative] || [];
      const next = current.includes(modelId)
        ? current.filter((m) => m !== modelId)
        : [...current, modelId];
      return { ...prev, [harnessNative]: next };
    });
  };

  // Select all models for a harness
  const selectAllModelsForHarness = (harnessNative: string, allModels: string[]) => {
    setHarnessSelectedModels((prev) => ({ ...prev, [harnessNative]: [...allModels] }));
  };

  // Clear all models for a harness
  const clearAllModelsForHarness = (harnessNative: string) => {
    setHarnessSelectedModels((prev) => ({ ...prev, [harnessNative]: [] }));
  };

  // Save Execution Settings
  const handleSaveExecution = async () => {
    if (!selectedMember) return;

    if (!selectedHostId) {
      setPendingAction(true);
      const ok = await updateUserExecution(selectedMember.id, null, null, null, null, null);
      setPendingAction(false);
      if (ok) {
        toast.success(`Runner and model access revoked for ${selectedMember.id}`);
        setExecutionMap((prev) => {
          const next = { ...prev };
          delete next[selectedMember.id];
          return next;
        });
        setSelectedMember(null);
        void refreshUsers();
      } else {
        toast.error(`Failed to revoke execution access for ${selectedMember.id}`);
      }
      return;
    }

    if (enabledHarnesses.length === 0) {
      toast.error(
        "Please enable at least one harness for this runner, or choose 'None' to revoke access.",
      );
      return;
    }

    setPendingAction(true);

    let finalAllowedModels: string[] | null = null;
    let anyCustom = false;
    const combinedModels: string[] = [];

    for (const hNative of enabledHarnesses) {
      const mode = harnessModelModes[hNative] || "all";
      if (mode === "custom") {
        anyCustom = true;
        const sel = harnessSelectedModels[hNative] || [];
        combinedModels.push(...sel);
      } else {
        const rh = detectedHarnesses.find(
          (r) =>
            r.harnessKey === hNative ||
            `${r.harnessKey}-native` === hNative ||
            (hNative.startsWith("antigravity") && r.harnessKey === "antigravity") ||
            (hNative.startsWith("codex") && r.harnessKey === "codex"),
        );
        if (rh) {
          combinedModels.push(...rh.models);
        }
      }
    }

    if (anyCustom) {
      finalAllowedModels = combinedModels.length > 0 ? Array.from(new Set(combinedModels)) : [];
    } else {
      finalAllowedModels = null;
    }

    const finalDefaultHarness = enabledHarnesses.includes(defaultHarness)
      ? defaultHarness
      : enabledHarnesses[0];

    let finalDefaultModel: string | null = defaultModel;
    if (
      !finalDefaultModel ||
      (finalAllowedModels && !finalAllowedModels.includes(finalDefaultModel))
    ) {
      finalDefaultModel =
        finalAllowedModels && finalAllowedModels.length > 0 ? finalAllowedModels[0] : null;
      if (!finalDefaultModel) {
        const rh = detectedHarnesses.find(
          (r) =>
            r.harnessKey === finalDefaultHarness || `${r.harnessKey}-native` === finalDefaultHarness,
        );
        finalDefaultModel = rh && rh.models.length > 0 ? rh.models[0] : "gemini-3.8-flash-high";
      }
    }

    const ok = await updateUserExecution(
      selectedMember.id,
      selectedHostId,
      finalAllowedModels,
      finalDefaultHarness,
      finalDefaultModel,
      enabledHarnesses,
    );
    setPendingAction(false);

    if (ok) {
      toast.success(`Execution settings saved for ${selectedMember.id}`);
      setExecutionMap((prev) => ({
        ...prev,
        [selectedMember.id]: {
          host_id: selectedHostId,
          level: 1,
          harness: finalDefaultHarness,
          allowed_harnesses: enabledHarnesses,
          default_model: finalDefaultModel,
          allowed_models: finalAllowedModels,
        },
      }));
      setSelectedMember(null);
      void refreshUsers();
    } else {
      toast.error(`Failed to save execution settings for ${selectedMember.id}`);
    }
  };

  const rebaseUrl = (serverUrl: string): string => {
    try {
      const parsed = new URL(serverUrl);
      return `${window.location.origin}${withBasePath(parsed.pathname)}${parsed.search}${parsed.hash}`;
    } catch {
      return serverUrl;
    }
  };

  const formatTtl = (expiresAt: number | undefined): string => {
    if (expiresAt === undefined) return "soon";
    const secs = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    const hours = Math.round(secs / 3600);
    if (hours >= 1) return `${hours}h`;
    return `${Math.max(1, Math.round(secs / 60))}m`;
  };

  // Invite creation
  const onCreateInvite = async () => {
    setPendingAction(true);
    try {
      const result =
        organizations.length > 0 && inviteOrgId
          ? await createInvite(
              inviteAsAdmin,
              inviteOrgId,
              inviteAsAdmin ? "admin" : inviteRole,
            )
          : await createInvite(inviteAsAdmin);
      setPendingAction(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setShowCreateInvite(false);
      setInviteResult(result);
      setInviteAsAdmin(false);
      void refreshUsers();
    } catch (err) {
      setPendingAction(false);
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Reset password
  const onResetPassword = async (userId: string) => {
    setPendingAction(true);
    try {
      const result = await resetUserPassword(userId);
      setPendingAction(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResetResult(result);
      toast.success(`Password reset for ${userId}`);
    } catch (err) {
      setPendingAction(false);
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Delete user
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setPendingAction(true);
    try {
      const result = await deleteUser(deletingUser.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`User ${deletingUser.id} deleted`);
      setDeletingUser(null);
      void refreshUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingAction(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // GATING GUARDS
  // ═══════════════════════════════════════════════════════════════════════
  if (isSingleUser) {
    return (
      <PageScroll contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Members</h1>
        <p className="text-sm text-muted-foreground">
          Member management is not available in single-user mode.
        </p>
      </PageScroll>
    );
  }

  if (meIsAdmin === null) {
    return (
      <PageScroll contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Members</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageScroll>
    );
  }

  if (!meIsAdmin && !isSupervisor) {
    return (
      <PageScroll contentClassName="px-4 md:px-8" extraBottom="2.5rem">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Members</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to manage members.
        </p>
      </PageScroll>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 1: DEDICATED MEMBER EXECUTION SETTINGS PAGE
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedMember) {
    const memberInitials = selectedMember.id ? selectedMember.id.slice(0, 2).toUpperCase() : "M";

    return (
      <PageScroll
        maxWidthClassName="max-w-4xl"
        contentClassName="px-4 md:px-8"
        extraBottom="2.5rem"
      >
        {/* Navigation Breadcrumb & Hero Header */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/95 via-card/85 to-card/50 p-6 shadow-sm backdrop-blur-xl">
          {/* Ambient decorative lighting */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#09747e]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 size-44 rounded-full bg-[#ffaa07]/10 blur-3xl" />

          {/* Breadcrumb */}
          <div className="relative mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setSelectedMember(null)}
              className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeftIcon className="size-3.5" /> Members
            </button>
            <span className="opacity-40">/</span>
            <span className="font-mono font-semibold text-[#ffaa07]">{selectedMember.id}</span>
            <span className="opacity-40">/</span>
            <span>Execution Settings</span>
          </div>

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Avatar Squircle */}
              <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#09747e]/30 bg-gradient-to-br from-[#09747e]/25 via-[#0e2a2a] to-[#ffaa07]/20 text-lg font-bold tracking-wider text-foreground shadow-md shadow-[#09747e]/10 ring-1 ring-white/10">
                {memberInitials}
                <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-background ring-2 ring-background">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                    {selectedMember.id}
                  </h1>
                  {selectedMember.is_admin ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffaa07]/35 bg-[#ffaa07]/10 px-2.5 py-0.5 text-xs font-semibold text-[#ffaa07] shadow-sm">
                      <ShieldCheckIcon className="size-3.5" />
                      <span>Admin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      <UserIcon className="size-3.5" />
                      <span>Member</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Active
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  <span>
                    Last login:{" "}
                    {selectedMember.last_login_at
                      ? `${relativeTime(selectedMember.last_login_at * 1000)} (${absoluteTime(selectedMember.last_login_at * 1000)})`
                      : "Never"}
                  </span>
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMember(null)}
              className="gap-1.5 border-border/80 font-medium hover:border-border hover:bg-muted/30"
            >
              <ArrowLeftIcon className="size-3.5" /> Back to Members
            </Button>
          </div>
        </div>

        {/* Execution Form Card */}
        <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 via-card/75 to-card/50 shadow-md backdrop-blur-xl">
          <CardContent className="p-5 sm:p-7 space-y-6">
            {/* Section: Profile Overview */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserIcon className="size-3.5 text-[#ffaa07]" /> Member Profile
              </h3>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-start md:items-center">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <div className="md:col-span-3">
                    <Input
                      value={selectedMember.id}
                      readOnly
                      className="h-9 text-xs font-mono bg-muted/30 cursor-default"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-start md:items-center">
                  <label className="text-xs font-semibold text-muted-foreground">Privileges</label>
                  <div className="md:col-span-3 text-xs text-muted-foreground leading-relaxed">
                    {selectedMember.is_admin
                      ? "Full Administrator privileges (can manage all sessions, runners, members, and policies)."
                      : "Standard Member (restricted strictly to assigned sessions, runners, and allowed models)."}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Execution Settings */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-2.5 gap-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CpuIcon className="size-4 text-[#ffaa07]" />
                  Compute Execution Environment
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Configures runner host machine and per-harness allowed AI models
                </span>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-5">
                {/* Runner Host Selector */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-start md:items-center">
                  <div>
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ServerIcon className="size-3.5 text-[#09747e]" />
                      Runtime Runner
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Target execution machine
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <div className="relative">
                      <select
                        value={selectedHostId}
                        onChange={(e) => void handleHostChange(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-card/90 px-3.5 py-2 text-xs shadow-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ffaa07] appearance-none cursor-pointer text-foreground"
                      >
                        <option value="">None (No Runner Assigned — Revoke)</option>
                        {displayHosts.map((h) => (
                          <option key={h.host_id} value={h.host_id}>
                            {h.status === "online" ? "● " : "○ "} {h.name}{" "}
                            {h.status === "online" ? "— ONLINE" : "— OFFLINE"}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-muted-foreground">
                        <ChevronDownIcon className="size-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detected Harnesses & Model Permissions */}
                {selectedHostId && detectedHarnesses.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Harnesses &amp; Model Access Control
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Enable harnesses and customize permitted models
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {detectedHarnesses.map((rh) => {
                        const hNative =
                          rh.harnessKey === "antigravity"
                            ? "antigravity-native"
                            : rh.harnessKey === "codex"
                            ? "codex-native"
                            : `${rh.harnessKey}-native`;
                        const isEnabled = enabledHarnesses.includes(hNative);
                        const isDefault = defaultHarness === hNative;
                        const currentMode = harnessModelModes[hNative] || "all";
                        const selectedModels = harnessSelectedModels[hNative] || [];

                        return (
                          <div
                            key={hNative}
                            className={`rounded-xl border transition-all ${
                              isEnabled
                                ? "border-[#ffaa07]/40 bg-card/85 shadow-sm"
                                : "border-border/40 bg-muted/10 opacity-60"
                            }`}
                          >
                            {/* Harness Header */}
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => toggleHarness(hNative)}
                                    className="size-4 rounded border-input accent-[#ffaa07] cursor-pointer"
                                  />
                                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                                    {rh.harnessKey === "antigravity" ? (
                                      <SparklesIcon className="size-3.5 text-[#ffaa07]" />
                                    ) : (
                                      <TerminalIcon className="size-3.5 text-cyan-400" />
                                    )}
                                    {rh.harnessName}
                                  </span>
                                </label>
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                                  <span className="size-1.5 rounded-full bg-emerald-400" /> Ready on
                                  Runner
                                </span>
                              </div>

                              {isEnabled && (
                                <div className="flex items-center gap-2">
                                  {isDefault ? (
                                    <Badge className="text-[11px] py-0.5 px-2.5 bg-[#ffaa07]/20 text-[#ffaa07] border-[#ffaa07]/40 flex items-center gap-1">
                                      ★ Default Starting Harness
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDefaultHarness(hNative)}
                                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Set as Default
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Harness Model Mode Configuration */}
                            {isEnabled && (
                              <div className="p-4 bg-muted/10 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-foreground">
                                    Allowed Models for {rh.harnessName}:
                                  </span>
                                  <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50">
                                    <button
                                      type="button"
                                      onClick={() => setHarnessMode(hNative, "all", rh.models)}
                                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                                        currentMode === "all"
                                          ? "bg-card text-foreground shadow-xs font-semibold"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      All Models ({rh.models.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setHarnessMode(hNative, "custom", rh.models)}
                                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                                        currentMode === "custom"
                                          ? "bg-[#ffaa07] text-[#061212] font-semibold shadow-xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      Custom Allowed Models ({selectedModels.length})
                                    </button>
                                  </div>
                                </div>

                                {currentMode === "custom" && (
                                  <div className="pt-2 space-y-2.5 border-t border-border/30">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="relative flex-1 max-w-xs">
                                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                                        <Input
                                          type="text"
                                          placeholder="Search model name..."
                                          value={modelFilter[hNative] || ""}
                                          onChange={(e) =>
                                            setModelFilter((prev) => ({
                                              ...prev,
                                              [hNative]: e.target.value,
                                            }))
                                          }
                                          className="pl-7 h-7 text-xs bg-card/80"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                                          onClick={() =>
                                            selectAllModelsForHarness(hNative, rh.models)
                                          }
                                        >
                                          Select All
                                        </Button>
                                        <span className="text-border">|</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                                          onClick={() => clearAllModelsForHarness(hNative)}
                                        >
                                          Clear All
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Model Pills Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 pr-1.5">
                                      {rh.models
                                        .filter((m) => {
                                          const filter = (modelFilter[hNative] || "")
                                            .toLowerCase()
                                            .trim();
                                          return !filter || m.toLowerCase().includes(filter);
                                        })
                                        .map((m) => {
                                          const checked = selectedModels.includes(m);
                                          const isModelDefault = defaultModel === m;
                                          const modelName = m.includes("/") ? m.split("/")[1] : m;

                                          return (
                                            <div
                                              key={m}
                                              className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs transition-all ${
                                                checked
                                                  ? "border-[#ffaa07]/40 bg-[#ffaa07]/5"
                                                  : "border-border/40 bg-card/40 opacity-70"
                                              }`}
                                            >
                                              <label className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() =>
                                                    toggleModelForHarness(hNative, m)
                                                  }
                                                  className="size-3.5 rounded border-input accent-[#ffaa07] cursor-pointer"
                                                />
                                                <span
                                                  className={`font-mono text-[11px] truncate ${checked ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                                                  title={m}
                                                >
                                                  {modelName}
                                                </span>
                                              </label>

                                              {checked && (
                                                <button
                                                  type="button"
                                                  onClick={() => setDefaultModel(m)}
                                                  title="Set as default model for this member"
                                                  className={`text-[10px] px-2 py-0.5 rounded transition-all shrink-0 font-medium cursor-pointer ${
                                                    isModelDefault
                                                      ? "bg-[#ffaa07] text-[#061212] font-bold shadow-xs"
                                                      : "text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground"
                                                  }`}
                                                >
                                                  {isModelDefault ? "Default" : "Make Default"}
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-4 border-t border-border/50">
              <Button
                variant="outline"
                className="w-full sm:w-auto font-medium"
                onClick={() => setSelectedMember(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveExecution}
                disabled={pendingAction}
                className="w-full sm:w-auto px-6 bg-gradient-to-r from-[#ffaa07] to-[#f59e0b] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 hover:from-[#ffb82e] hover:to-[#ffaa07] transition-all disabled:opacity-50"
              >
                {pendingAction ? "Saving…" : "Save Execution Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageScroll>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 2: MEMBERS LIST OVERVIEW (DEFAULT PAGE)
  // ═══════════════════════════════════════════════════════════════════════
  const totalCount = users?.length ?? 0;
  const adminCount =
    users?.filter(
      (u) =>
        u.is_admin ||
        u.organizations?.some(
          (o) => o.role === "supervisor" || o.role === "admin" || o.role === "lead",
        ),
    ).length ?? 0;
  const onlineRunners = hosts.filter((h) => h.status === "online").length;

  return (
    <PageScroll maxWidthClassName="max-w-6xl" contentClassName="px-4 md:px-8" extraBottom="2.5rem">
      {/* Hero Header Card */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/95 via-card/85 to-card/50 p-6 shadow-sm backdrop-blur-xl">
        {/* Ambient decorative lighting */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#09747e]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/4 size-44 rounded-full bg-[#ffaa07]/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#ffaa07]/30 bg-gradient-to-br from-[#ffaa07]/20 via-[#0e2a2a] to-[#09747e]/20 text-[#ffaa07] shadow-sm">
              <UsersIcon className="size-6" />
            </div>
            <div>
              <h1 className="settings-page-title text-2xl font-bold tracking-tight text-foreground">
                Members
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage user accounts, assign compute runners, and configure model access policies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshUsers()}
              disabled={isRefreshing}
              className="gap-1.5 border-border/80 text-muted-foreground hover:text-foreground"
              title="Refresh members list"
            >
              <RefreshCwIcon className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {manageable && (
              <Button
                size="sm"
                onClick={() => setShowCreateInvite(true)}
                disabled={pendingAction}
                className="gap-1.5 bg-gradient-to-r from-[#ffaa07] to-[#f59e0b] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 hover:from-[#ffb82e] hover:to-[#ffaa07] transition-all"
              >
                <UserPlusIcon className="size-3.5" />
                <span>Invite member</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* OIDC Information Notice */}
      {!manageable && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground backdrop-blur-sm">
          <InfoIcon className="size-4 shrink-0 text-[#ffaa07]" />
          <span>
            Single Sign-On (OIDC) is active. Members are provisioned automatically on first sign-in
            via your identity provider. Local invite, password reset, and removal actions are
            disabled.
          </span>
        </div>
      )}

      {/* Error alert */}
      {loadError && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>Failed to load members: {loadError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refreshUsers()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Members</span>
            <UsersIcon className="size-4 text-[#ffaa07]" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{totalCount}</div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Privileged Users</span>
            <ShieldCheckIcon className="size-4 text-[#ffaa07]" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{adminCount}</div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Runners</span>
            <ServerIcon className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {onlineRunners} <span className="text-xs font-normal text-muted-foreground">/ {hosts.length}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Divisions</span>
            <BuildingIcon className="size-4 text-[#09747e]" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {organizations.length > 0 ? organizations.length : 1}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3 backdrop-blur-sm">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search member or division..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-card/80 border-border/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Division Filter */}
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="h-8 rounded-lg border border-border/70 bg-card/80 px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-[#ffaa07] text-foreground cursor-pointer"
          >
            <option value="all">All Divisions</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-8 rounded-lg border border-border/70 bg-card/80 px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-[#ffaa07] text-foreground cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Global Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="member">Member</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground whitespace-nowrap font-medium self-end sm:self-center">
          Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> of{" "}
          {users?.length || 0} members
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 via-card/80 to-card/50 shadow-md backdrop-blur-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[780px]">
          <thead className="bg-muted/30 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border/60">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Member</th>
              <th className="px-4 py-3.5 text-left font-semibold">Role &amp; Division</th>
              <th className="px-4 py-3.5 text-left font-semibold">Runtime / Runner</th>
              <th className="px-4 py-3.5 text-left font-semibold">Model Policy</th>
              <th className="px-4 py-3.5 text-left font-semibold whitespace-nowrap">Last Active</th>
              <th className="px-5 py-3.5 text-right font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {users !== null && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UsersIcon className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">No members yet.</p>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((u) => {
                const exec = executionMap[u.id];
                const assignedHost = hosts.find((h) => h.host_id === exec?.host_id);
                const allowedH = exec?.allowed_harnesses || (exec?.harness ? [exec.harness] : []);
                const hasAgy =
                  allowedH.some((h) => h.includes("antigravity")) ||
                  (exec?.allowed_models &&
                    exec.allowed_models.some((m) => m.startsWith("gemini-")));
                const hasCodex =
                  allowedH.some((h) => h.includes("codex")) ||
                  (exec?.allowed_models && exec.allowed_models.some((m) => m.startsWith("gpt-")));

                const isSupervisorRole = u.organizations?.some(
                  (o) => o.role === "supervisor" || o.role === "admin" || o.role === "lead",
                );

                const uInitials = u.id ? u.id.slice(0, 2).toUpperCase() : "U";

                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    {/* User Identity */}
                    <td className="px-5 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-xs border ${
                            u.is_admin
                              ? "border-[#ffaa07]/40 bg-[#ffaa07]/15 text-[#ffaa07]"
                              : isSupervisorRole
                              ? "border-[#09747e]/40 bg-[#09747e]/15 text-cyan-400"
                              : "border-border/80 bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {uInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openMemberExecution(u)}
                              className="font-mono text-xs font-semibold text-foreground hover:underline hover:text-[#ffaa07] text-left truncate max-w-[150px] cursor-pointer"
                              title={u.id}
                            >
                              {u.id}
                            </button>
                            {u.id === meId && (
                              <span className="inline-flex items-center rounded-md border border-[#ffaa07]/30 bg-[#ffaa07]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[#ffaa07]">
                                (you)
                              </span>
                            )}
                            {!u.has_password && (
                              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                                External
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Division */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-1 items-start">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffaa07]/10 text-[#ffaa07] border border-[#ffaa07]/30 shadow-xs">
                            <ShieldCheckIcon className="size-3" />
                            <span>Admin</span>
                          </span>
                        ) : u.organizations && u.organizations.length > 0 ? (
                          u.organizations.map((org) => {
                            const isSpv =
                              org.role === "supervisor" ||
                              org.role === "admin" ||
                              org.role === "lead";
                            return (
                              <span
                                key={org.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                  isSpv
                                    ? "border-[#09747e]/40 text-cyan-400 bg-[#09747e]/15"
                                    : "border-border/60 text-muted-foreground bg-muted/40"
                                }`}
                              >
                                <span className="font-semibold text-foreground">{org.name}</span>
                                <span className="text-[10px] opacity-75">
                                  ({isSpv ? "Supervisor" : "Member"})
                                </span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted/40 text-muted-foreground border border-border/50">
                            Member
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Runtime / Runner Column */}
                    <td className="px-4 py-3.5 align-middle">
                      {assignedHost ? (
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`size-2 rounded-full shrink-0 ${
                                assignedHost.status === "online"
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                  : "bg-zinc-400"
                              }`}
                            />
                            <span
                              className="font-mono text-xs font-medium text-foreground truncate max-w-[180px]"
                              title={assignedHost.name}
                            >
                              {assignedHost.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {hasAgy && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#ffaa07]/10 text-[#ffaa07] border border-[#ffaa07]/25">
                                <SparklesIcon className="size-2.5" /> Antigravity
                              </span>
                            )}
                            {hasCodex && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                                <TerminalIcon className="size-2.5" /> Codex
                              </span>
                            )}
                            {!hasAgy && !hasCodex && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Default Harness
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic flex items-center gap-1">
                          <ServerIcon className="size-3 opacity-40" /> None assigned
                        </span>
                      )}
                    </td>

                    {/* Allowed Models Column */}
                    <td className="px-4 py-3.5 align-middle">
                      {exec?.allowed_models && exec.allowed_models.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {exec.allowed_models.slice(0, 2).map((m) => (
                            <span
                              key={m}
                              title={m}
                              className="inline-block px-1.5 py-0.5 rounded bg-muted/70 text-foreground font-mono text-[10px] border border-border/50 truncate max-w-[110px]"
                            >
                              {m.includes("/") ? m.split("/")[1] : m}
                            </span>
                          ))}
                          {exec.allowed_models.length > 2 && (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono text-[10px] border border-border/40"
                              title={exec.allowed_models.slice(2).join(", ")}
                            >
                              +{exec.allowed_models.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : assignedHost ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25">
                          All Models
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3.5 align-middle whitespace-nowrap text-xs text-muted-foreground">
                      {u.last_login_at ? (
                        <span title={absoluteTime(u.last_login_at * 1000)}>
                          {relativeTime(u.last_login_at * 1000)}
                        </span>
                      ) : (
                        "Never"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 font-medium border-border/80 hover:border-[#ffaa07]/50 hover:bg-[#ffaa07]/10 hover:text-[#ffaa07] transition-all shadow-xs"
                          onClick={() => openMemberExecution(u)}
                        >
                          <SlidersHorizontalIcon className="mr-1.5 size-3.5 text-primary" />
                          Execution
                        </Button>

                        {manageable && (
                          <>
                            {(!isSupervisor || !u.is_admin) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 border-border/80 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all font-medium disabled:opacity-40"
                                onClick={() => void onResetPassword(u.id)}
                                disabled={!u.has_password || pendingAction}
                                title="Reset user password"
                              >
                                <KeyRoundIcon className="mr-1 size-3.5" />
                                Reset
                              </Button>
                            )}
                            {(!isSupervisor || !u.is_admin) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60 transition-all font-medium disabled:opacity-40"
                                onClick={() => setDeletingUser(u)}
                                disabled={u.id === meId || pendingAction}
                                title="Remove member"
                              >
                                <Trash2Icon className="mr-1 size-3.5" />
                                Remove
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      No members match your search or filter criteria.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-[#ffaa07] hover:underline"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterDivision("all");
                        setFilterRole("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: CREATE INVITE DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showCreateInvite}
        onOpenChange={(open) => {
          setShowCreateInvite(open);
          if (!open) setInviteAsAdmin(false);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="text-center sm:text-left">
            <div className="mx-auto sm:mx-0 mb-3 flex size-11 items-center justify-center rounded-xl border border-[#ffaa07]/30 bg-[#ffaa07]/10 text-[#ffaa07] shadow-sm">
              <UserPlusIcon className="size-5.5" />
            </div>
            <DialogTitle className="text-lg font-bold">Invite member</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create an invite link for a new member to join this instance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate an invite link for a new member. The recipient will choose their own
              username and password upon registration.
            </p>

            {/* Division / Organization selector */}
            {organizations.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="invite_org" className="text-xs font-semibold text-foreground">
                  Divisi / Organization:
                </label>
                <select
                  id="invite_org"
                  value={inviteOrgId}
                  onChange={(e) => setInviteOrgId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-card/80 px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-[#ffaa07] text-foreground cursor-pointer"
                >
                  {meIsAdmin && <option value="">(None / General)</option>}
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role selector */}
            <div className="space-y-1.5">
              <label htmlFor="invite_role" className="text-xs font-semibold text-foreground">
                Role:
              </label>
              <select
                id="invite_role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                disabled={!meIsAdmin}
                className="w-full h-9 rounded-lg border border-input bg-card/80 px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-[#ffaa07] text-foreground disabled:opacity-60 cursor-pointer"
              >
                <option value="member">Member (Staff Divisi)</option>
                {meIsAdmin && <option value="supervisor">Supervisor (Kepala Divisi)</option>}
              </select>
              {!meIsAdmin && (
                <p className="text-[11px] text-muted-foreground">
                  Supervisors can only invite members to their assigned division.
                </p>
              )}
            </div>

            {meIsAdmin && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <input
                  type="checkbox"
                  id="is_admin"
                  checked={inviteAsAdmin}
                  onChange={(e) => setInviteAsAdmin(e.target.checked)}
                  className="size-4 rounded border-input accent-[#ffaa07] cursor-pointer"
                />
                <label htmlFor="is_admin" className="text-xs cursor-pointer select-none">
                  Grant Global Administrator privileges
                </label>
              </div>
            )}

            <DialogFooter className="pt-2 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateInvite(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void onCreateInvite()}
                disabled={pendingAction}
                className="bg-gradient-to-r from-[#ffaa07] to-[#f59e0b] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 hover:from-[#ffb82e] hover:to-[#ffaa07] transition-all disabled:opacity-50"
              >
                {pendingAction ? "Creating…" : "Create invite"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: INVITE CREATED RESULT DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={inviteResult !== null}
        onOpenChange={(open) => {
          if (!open) setInviteResult(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="text-center sm:text-left">
            <div className="mx-auto sm:mx-0 mb-3 flex size-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm">
              <CheckCircle2Icon className="size-5.5" />
            </div>
            <DialogTitle className="text-lg font-bold">Invite URL</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send this single-use URL to the new member. It expires in{" "}
              {formatTtl(inviteResult?.expires_at)}. This URL is shown only once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input
              readOnly
              value={rebaseUrl(inviteResult?.register_url || "")}
              className="font-mono text-xs bg-background/80 select-all"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="w-full bg-gradient-to-r from-[#ffaa07] to-[#f59e0b] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 hover:from-[#ffb82e] hover:to-[#ffaa07]"
              onClick={() => {
                if (inviteResult) {
                  void navigator.clipboard.writeText(rebaseUrl(inviteResult.register_url));
                  setInviteCopied(true);
                  toast.success("Invite link copied to clipboard");
                  setTimeout(() => setInviteCopied(false), 2000);
                }
              }}
            >
              <CopyIcon className="size-4 mr-1.5" />
              {inviteCopied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setInviteResult(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: PASSWORD RESET RESULT DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={resetResult !== null}
        onOpenChange={(open) => {
          if (!open) setResetResult(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="text-center sm:text-left">
            <div className="mx-auto sm:mx-0 mb-3 flex size-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm">
              <KeyRoundIcon className="size-5.5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              New password for {resetResult?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send this temporary password to <strong>{resetResult?.id}</strong>. It is shown only
              once and all existing active sessions have been revoked.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input
              readOnly
              value={resetResult?.new_password || ""}
              className="font-mono text-sm font-bold bg-background/80 select-all"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="w-full bg-gradient-to-r from-[#ffaa07] to-[#f59e0b] font-semibold text-[#061212] shadow-md shadow-[#ffaa07]/20 hover:from-[#ffb82e] hover:to-[#ffaa07]"
              onClick={() => {
                if (resetResult) {
                  void navigator.clipboard.writeText(resetResult.new_password);
                  setResetCopied(true);
                  toast.success("Password copied to clipboard");
                  setTimeout(() => setResetCopied(false), 2000);
                }
              }}
            >
              <CopyIcon className="size-4 mr-1.5" />
              {resetCopied ? "Copied!" : "Copy Password"}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setResetResult(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: REMOVE USER CONFIRMATION DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="text-center sm:text-left">
            <div className="mx-auto sm:mx-0 mb-3 flex size-11 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive shadow-sm">
              <Trash2Icon className="size-5.5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Remove {deletingUser?.id}?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove user <strong>{deletingUser?.id}</strong>? All
              assigned permissions, runner mappings, and active sessions will be permanently
              revoked. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={pendingAction}
              className="font-semibold shadow-sm"
            >
              {pendingAction ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScroll>
  );
}
